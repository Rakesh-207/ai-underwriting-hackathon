import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppBindings } from './env.ts';
import { API_SCHEMA_VERSION, type AuditEvent, type ConsentPurpose, type ConsentReceipt } from '@underwriting/shared';
import { errorResponse, generateRequestId } from './errors.ts';
import { requireAuth } from './auth.ts';
import { cors } from './cors.ts';
import { repository } from './repository.ts';
import { computeScore } from './engine/scorecard.ts';
import { isObject, requiredString, requiredStringArray, validateConsent, type JsonObject } from './validation.ts';

const app = new Hono<AppBindings>();
app.use('*', cors());

app.get('/api/health', (c) => c.json({
  schemaVersion: API_SCHEMA_VERSION, status: 'ok', service: 'underwriting-simulation-api', repository: 'memory', modelVersion: 'scorecard-v1', generatedAt: new Date().toISOString(),
}));

const protectedApi = new Hono<AppBindings>();
protectedApi.use('*', requireAuth());

function audit(simulationId: string, applicantId: string, eventType: AuditEvent['eventType'], principal: string, detail: Record<string, string | number | boolean> = {}) {
  const event: AuditEvent = {
    schemaVersion: '1.1', eventId: `audit-${crypto.randomUUID()}`, simulationId, applicantId, eventType,
    occurredAt: new Date().toISOString(), modelVersion: eventType === 'score' ? 'scorecard-v1' : null,
    featureRegistryVersion: eventType === 'score' ? 'features-v1' : null, consentIds: [], provenanceRefs: [],
    detail: { ...detail, actor: principal },
  };
  repository.addAudit(event);
  return event;
}

function forbidden() {
  return errorResponse('FORBIDDEN', 'You do not own this simulation.', generateRequestId(), 403);
}

async function body(c: Context<AppBindings>): Promise<JsonObject | null> {
  try {
    const parsed: unknown = await c.req.json();
    return isObject(parsed) ? parsed : null;
  } catch { return null; }
}

function validationFailure(c: Context<AppBindings>, simulationId: string, principal: string, fields: Record<string, string[]> = {}) {
  audit(simulationId, 'unknown', 'validation_failure', principal, { route: c.req.path });
  return errorResponse('VALIDATION_ERROR', 'Request validation failed.', generateRequestId(), 400, fields);
}

function ownedSimulation(simulationId: string, principal: string) {
  const simulation = repository.getSimulation(simulationId);
  return simulation?.clerkUserId === principal ? simulation : undefined;
}

function activeConsent(simulationId: string, purpose: ConsentPurpose) {
  return repository.listConsents(simulationId).find((receipt) => receipt.status === 'granted' && receipt.purposes.includes(purpose));
}

protectedApi.get('/api/demo/applicants', (c) => {
  const principal = c.get('principal')!.clerkUserId;
  const ownedApplicantIds = new Set(repository.listSimulations().filter((simulation) => simulation.clerkUserId === principal && repository.listConsents(simulation.simulationId).some((receipt) => receipt.status === 'granted')).map((simulation) => simulation.applicantId));
  const applicants = repository.listApplicants().filter((applicant) => ownedApplicantIds.has(applicant.applicantId));
  if (applicants.length === 0) return errorResponse('CONSENT_REQUIRED', 'Consent is required before applicant data is available.', generateRequestId(), 403);
  return c.json({ schemaVersion: API_SCHEMA_VERSION, applicants: applicants.map((item) => ({ applicantId: item.applicantId, displayName: item.displayName, fixtureId: item.applicantId, source: 'synthetic_fixture' as const, baseline: item.baseline, alternative: item.alternative, provenance: item.provenance })), generatedAt: new Date().toISOString() });
});

protectedApi.post('/api/consent', async (c) => {
  const principal = c.get('principal')!.clerkUserId;
  const input = await body(c);
  const parsed = validateConsent(input);
  const simulationId = input && requiredString(input, 'simulationId');
  const applicantId = input && requiredString(input, 'applicantId');
  const purposes = input && requiredStringArray(input, 'purposes');
  const categories = input && requiredStringArray(input, 'categories');
  if (!input || !simulationId || !applicantId || !purposes?.length || !categories?.length || !['synthetic_fixture', 'consented_manual_entry'].includes(String(input.source))) return validationFailure(c, simulationId ?? 'unknown', principal, parsed.fieldErrors);
  const applicant = repository.listApplicants().find((item) => item.applicantId === applicantId);
  if (!applicant) return validationFailure(c, simulationId, principal, { applicantId: ['Unknown synthetic applicant.'] });
  const now = new Date().toISOString();
  const receipt: ConsentReceipt = { schemaVersion: '1.1', consentId: `con-${crypto.randomUUID()}`, simulationId, applicantId, purposes: purposes as ConsentPurpose[], categories, source: input.source as 'synthetic_fixture' | 'consented_manual_entry', status: 'granted', grantedAt: now, revokedAt: null, retention: 'demo_session', receiptHash: `sha256:${crypto.randomUUID()}`, identityProvider: 'clerk', clerkUserId: principal };
  repository.ensureSimulation(simulationId, principal, applicantId);
  repository.saveConsent(receipt);
  const event = audit(simulationId, applicantId, 'consent', principal, { mutation: 'grant' });
  event.consentIds.push(receipt.consentId);
  return c.json({ schemaVersion: API_SCHEMA_VERSION, receipt, auditEventId: event.eventId, generatedAt: now }, 201);
});

protectedApi.post('/api/consent/:consentId/revoke', (c) => {
  const principal = c.get('principal')!.clerkUserId;
  const receipt = repository.getConsent(c.req.param('consentId'));
  if (!receipt) return errorResponse('NOT_FOUND', 'Consent receipt not found.', generateRequestId(), 404);
  if (receipt.clerkUserId !== principal) return forbidden();
  if (receipt.status === 'revoked') return c.json({ schemaVersion: API_SCHEMA_VERSION, receipt, auditEventId: audit(receipt.simulationId, receipt.applicantId, 'consent', principal, { mutation: 'revoke_repeat' }).eventId, generatedAt: new Date().toISOString() });
  const revoked = { ...receipt, status: 'revoked' as const, revokedAt: new Date().toISOString() };
  repository.saveConsent(revoked);
  const event = audit(receipt.simulationId, receipt.applicantId, 'consent', principal, { mutation: 'revoke' });
  event.consentIds.push(receipt.consentId);
  return c.json({ schemaVersion: API_SCHEMA_VERSION, receipt: revoked, auditEventId: event.eventId, generatedAt: new Date().toISOString() });
});

protectedApi.post('/api/score', async (c) => {
  const principal = c.get('principal')!.clerkUserId;
  const input = await body(c);
  const simulationId = input && requiredString(input, 'simulationId');
  const applicantId = input && requiredString(input, 'applicantId');
  const mode = input?.mode;
  const simulation = simulationId && ownedSimulation(simulationId, principal);
  if (!input || !simulationId || !applicantId || !simulation || (mode !== 'baseline_only' && mode !== 'consented_dynamic')) return validationFailure(c, simulationId ?? 'unknown', principal);
  if (mode === 'consented_dynamic' && !activeConsent(simulationId, 'alternative_cashflow')) return errorResponse('CONSENT_REQUIRED', 'Alternative-data consent is required.', generateRequestId(), 403);
  const applicant = repository.listApplicants().find((item) => item.applicantId === applicantId);
  if (!applicant) return validationFailure(c, simulationId, principal);
  const event = audit(simulationId, applicantId, 'score', principal, { mode });
  const result = computeScore({ schemaVersion: '1.1', simulationId, applicant, consentReceipts: repository.listConsents(simulationId), behaviorUpdates: simulation.behaviorUpdates, mode }, new Date().toISOString());
  result.auditEventId = event.eventId;
  repository.saveScore(result);
  return c.json({ schemaVersion: API_SCHEMA_VERSION, result, generatedAt: result.generatedAt });
});

protectedApi.post('/api/behavior', async (c) => {
  const principal = c.get('principal')!.clerkUserId;
  const input = await body(c);
  const simulationId = input && requiredString(input, 'simulationId');
  const applicantId = input && requiredString(input, 'applicantId');
  const consentId = input && requiredString(input, 'consentId');
  const eventType = input && requiredString(input, 'eventType');
  const value = input && typeof input.value === 'number' ? input.value : undefined;
  const simulation = simulationId && ownedSimulation(simulationId, principal);
  const consent = consentId && repository.getConsent(consentId);
  if (!input || !simulationId || !applicantId || !consentId || !eventType || !['income_observation', 'payment_observation', 'savings_observation'].includes(eventType) || value === undefined || !simulation) return validationFailure(c, simulationId ?? 'unknown', principal);
  if (!consent || consent.clerkUserId !== principal || consent.status !== 'granted' || !consent.purposes.includes('behavior_updates')) return errorResponse('CONSENT_REQUIRED', 'Behavior-update consent is required.', generateRequestId(), 403);
  const update = { updateId: `behavior-${crypto.randomUUID()}`, simulationId, applicantId, eventType: eventType as 'income_observation' | 'payment_observation' | 'savings_observation', value, observedAt: new Date().toISOString(), source: consent.source, consentId };
  repository.saveBehavior(update);
  const event = audit(simulationId, applicantId, 'behavior_update', principal, { eventType, value });
  event.consentIds.push(consentId);
  const applicant = repository.listApplicants().find((item) => item.applicantId === applicantId)!;
  const result = computeScore({ schemaVersion: '1.1', simulationId, applicant, consentReceipts: repository.listConsents(simulationId), behaviorUpdates: simulation.behaviorUpdates, mode: 'consented_dynamic' }, new Date().toISOString());
  const behaviorDelta = Math.round(Math.max(-20, Math.min(20, (value - 0.7) * 100)));
  result.dynamicScore = Math.max(300, Math.min(900, result.dynamicScore + behaviorDelta));
  result.riskBand = result.dynamicScore >= 750 ? 'strong' : result.dynamicScore >= 650 ? 'stable' : result.dynamicScore >= 550 ? 'guarded' : 'watch';
  result.auditEventId = event.eventId;
  repository.saveScore(result);
  return c.json({ schemaVersion: API_SCHEMA_VERSION, result, update, auditEventId: event.eventId, generatedAt: result.generatedAt });
});

protectedApi.post('/api/fairness', async (c) => {
  const principal = c.get('principal')!.clerkUserId;
  const input = await body(c);
  const simulationId = input && requiredString(input, 'simulationId');
  if (!input || !simulationId) return validationFailure(c, simulationId ?? 'unknown', principal);
  const simulation = repository.getSimulation(simulationId) ?? repository.ensureSimulation(simulationId, principal, 'app-hero');
  if (simulation.clerkUserId !== principal) return forbidden();
  const event = audit(simulationId, simulation.applicantId, 'fairness', principal, { datasetVersion: 'synthetic-cohort-v1' });
  const report = { schemaVersion: '1.1' as const, reportId: `fair-${crypto.randomUUID()}`, simulationId, datasetVersion: 'synthetic-cohort-v1', modelVersion: 'scorecard-v1', referenceCohort: 'cohort_alpha', cohorts: [{ cohort: 'cohort_alpha', sampleCount: 10, strongOrStableRate: 0.7, outcomeRate: null, selectionRateRatio: 1, adverseImpactRatio: 1, sampleSizeWarning: 'Synthetic demonstration cohort; not a production fairness estimate.' }, { cohort: 'cohort_beta', sampleCount: 10, strongOrStableRate: 0.6, outcomeRate: null, selectionRateRatio: 0.86, adverseImpactRatio: 0.86, sampleSizeWarning: 'Synthetic demonstration cohort; not a production fairness estimate.' }], limitations: ['Synthetic evaluation only.', 'Fairness cohorts are not model inputs.'], generatedAt: new Date().toISOString(), auditEventId: event.eventId };
  return c.json({ schemaVersion: API_SCHEMA_VERSION, report, generatedAt: report.generatedAt });
});

protectedApi.get('/api/audit/:simulationId', (c) => {
  const principal = c.get('principal')!.clerkUserId;
  const simulation = ownedSimulation(c.req.param('simulationId'), principal);
  if (!simulation) return forbidden();
  return c.json({ schemaVersion: API_SCHEMA_VERSION, simulationId: simulation.simulationId, events: repository.listAudit(simulation.simulationId), generatedAt: new Date().toISOString() });
});

app.route('/', protectedApi);
export default app;
