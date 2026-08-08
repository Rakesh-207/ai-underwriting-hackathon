import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppBindings } from './env.ts';
import {
  API_SCHEMA_VERSION,
  type AuditEvent,
  type ConsentPurpose,
  type ConsentReceipt,
  type EvidenceItem,
  type ScoreResult,
} from '@underwriting/shared';
import {
  recalculateWithBehaviorUpdate,
  scoreApplication,
  type BehaviorUpdate as EngineBehaviorUpdate,
  type UnderwritingEngineInput,
  type UnderwritingScoreResult,
} from '@underwriting/engine';
import { errorResponse, generateRequestId } from './errors.ts';
import { requireAuth } from './auth.ts';
import { cors } from './cors.ts';
import { repository, type SimulationRecord } from './repository.ts';
import { receiptHash, verifyReceiptHash } from './receipt-hash.ts';
import { MockAccountAggregatorProvider, MockDigiLockerProvider } from './providers/index.ts';
import { isObject, requiredString, requiredStringArray, validateConsent, type JsonObject } from './validation.ts';

const app = new Hono<AppBindings>();
app.use('*', cors());

app.get('/api/health', (c) => c.json({
  schemaVersion: API_SCHEMA_VERSION, status: 'ok', service: 'underwriting-simulation-api',
  repository: c.env.DB ? 'd1' : 'memory', modelVersion: 'scorecard-v1', generatedAt: new Date().toISOString(),
}));

const protectedApi = new Hono<AppBindings>();
protectedApi.use('*', requireAuth());

function audit(simulationId: string, applicantId: string, eventType: AuditEvent['eventType'], principal: string, detail: Record<string, string | number | boolean> = {}) {
  const event: AuditEvent = {
    schemaVersion: '1.1', eventId: `audit-${crypto.randomUUID()}`, simulationId, applicantId, clerkUserId: principal, eventType,
    occurredAt: new Date().toISOString(), modelVersion: eventType === 'score' ? 'scorecard-v1' : null,
    featureRegistryVersion: eventType === 'score' ? 'engine-v1' : null, consentIds: [], provenanceRefs: [], detail: { ...detail, actor: principal },
  };
  repository.addAudit(event);
  return event;
}

function forbidden() { return errorResponse('FORBIDDEN', 'You do not own this application.', generateRequestId(), 403); }

async function body(c: Context<AppBindings>): Promise<JsonObject | null> {
  try { const parsed: unknown = await c.req.json(); return isObject(parsed) ? parsed : null; } catch { return null; }
}

function validationFailure(c: Context<AppBindings>, simulationId: string, principal: string, fields: Record<string, string[]> = {}) {
  audit(simulationId, 'unknown', 'validation_failure', principal, { route: c.req.path });
  return errorResponse('VALIDATION_ERROR', 'Request validation failed.', generateRequestId(), 400, fields);
}

function ownedSimulation(simulationId: string, principal: string) {
  const simulation = repository.getSimulation(simulationId);
  return simulation?.clerkUserId === principal ? simulation : undefined;
}

function boundSimulation(simulationId: string, applicantId: string, principal: string) {
  const simulation = ownedSimulation(simulationId, principal);
  return simulation?.applicantId === applicantId ? simulation : undefined;
}

function activeConsent(simulationId: string, purpose: ConsentPurpose) {
  return repository.listConsents(simulationId).find((receipt) => receipt.status === 'granted' && receipt.purposes.includes(purpose));
}

async function receiptsAreValid(simulationId: string) {
  return Promise.all(repository.listConsents(simulationId).map((receipt) => verifyReceiptHash(receipt))).then((valid) => valid.every(Boolean));
}

function engineInput(simulation: SimulationRecord, mode: 'baseline_only' | 'consented_dynamic'): UnderwritingEngineInput {
  const behaviorUpdates: EngineBehaviorUpdate[] = simulation.behaviorUpdates.map((update) => ({
    updateId: update.updateId, eventType: update.eventType, value: update.value, observedAt: update.observedAt,
    source: 'synthetic_behavior', consentReference: update.consentId, provenance: `behavior:${update.updateId}`,
  }));
  return {
    applicantId: simulation.applicantId,
    application: simulation.application,
    declaredEmployment: simulation.declaredEmployment,
    accountAggregator: mode === 'consented_dynamic' ? simulation.providers.account_aggregator as UnderwritingEngineInput['accountAggregator'] : undefined,
    employment: mode === 'consented_dynamic' ? simulation.providers.digilocker_employment as UnderwritingEngineInput['employment'] : undefined,
    education: mode === 'consented_dynamic' ? simulation.providers.digilocker_education as UnderwritingEngineInput['education'] : undefined,
    behaviorUpdates: mode === 'consented_dynamic' ? behaviorUpdates : [],
    consentReceipts: repository.listConsents(simulation.simulationId).map((receipt) => ({
      source: receipt.source === 'synthetic_fixture' ? 'account_aggregator' : 'account_aggregator',
      consentReference: receipt.consentId, purpose: receipt.purposes.join(','), timestamp: receipt.grantedAt, provenanceReferences: [],
    })),
  };
}

function toScoreResult(simulationId: string, applicantId: string, result: UnderwritingScoreResult, auditEventId: string): ScoreResult {
  const evidence: EvidenceItem[] = result.evidence.map((item) => ({
    featureKey: item.id, label: item.label, normalizedValue: item.scoreContribution, signedPoints: item.scoreContribution,
    direction: item.direction, source: 'synthetic_fixture', consentId: item.consentReference === 'not_applicable' ? null : item.consentReference,
    explanation: item.explanation, provenanceRef: item.provenance,
  }));
  const riskBand = result.riskBand === 'strong' ? 'strong' : result.riskBand === 'moderate' ? 'guarded' : result.riskBand === 'watch' ? 'watch' : 'watch';
  return {
    schemaVersion: API_SCHEMA_VERSION, simulationId, scoreId: result.scoreId, applicantId,
    baselineScore: result.baselineScore, alternativeContribution: result.alternativeContribution, dynamicScore: result.dynamicScore,
    riskBand, scoreMeaning: 'higher_is_stronger_reliability', evidence, provenance: [], fraudReview: {
      status: result.anomalies.length ? 'review' : 'clear', flags: result.anomalies.map((anomaly) => ({ ruleKey: anomaly.id, severity: anomaly.severity, explanation: anomaly.explanation })),
      action: result.anomalies.length ? 'manual_review' : 'none', ruleVersion: 'engine-v1',
    }, modelVersion: 'scorecard-v1', featureRegistryVersion: 'engine-v1', generatedAt: result.generatedAt,
    auditEventId, costEstimate: { modelComputeMs: 0, dataAccess: 0, storageWrite: 1, explanation: 0, currency: 'USD', estimatedAmount: 0, basis: 'local_measurement' },
  };
}

async function ensureDynamicProvider(simulation: SimulationRecord, consent: ConsentReceipt) {
  if (simulation.providers.account_aggregator) return;
  const response = new MockAccountAggregatorProvider().fetch({
    persona: simulation.applicantId === 'app-hero' ? 'stable_salaried' : 'irregular_income',
    consent: { source: 'account_aggregator', purpose: 'cashflow_analysis', scopes: ['account_transactions'], timestamp: consent.grantedAt, consentReference: consent.consentId },
  });
  repository.saveProvider(simulation.simulationId, 'account_aggregator', response);
}

protectedApi.get('/api/applications', (c) => {
  const principal = c.get('principal')!.clerkUserId;
  return c.json({ schemaVersion: API_SCHEMA_VERSION, applications: repository.listSimulations().filter((item) => item.clerkUserId === principal), generatedAt: new Date().toISOString() });
});

protectedApi.post('/api/applications', async (c) => {
  const principal = c.get('principal')!.clerkUserId;
  const input = await body(c);
  const simulationId = input && requiredString(input, 'simulationId');
  const applicantId = input && requiredString(input, 'applicantId');
  const applicant = applicantId && repository.listApplicants().find((item) => item.applicantId === applicantId);
  if (!input || !simulationId || !applicantId || !applicant) return validationFailure(c, simulationId ?? 'unknown', principal);
  const existing = repository.getSimulation(simulationId);
  if (existing && existing.clerkUserId !== principal) return forbidden();
  const simulation = repository.ensureSimulation(simulationId, principal, applicantId);
  const application = isObject(input.application) ? {
    bureauScore: typeof input.application.bureauScore === 'number' ? input.application.bureauScore : simulation.application.bureauScore,
    monthlyIncome: typeof input.application.monthlyIncome === 'number' ? input.application.monthlyIncome : simulation.application.monthlyIncome,
    monthlyObligations: typeof input.application.monthlyObligations === 'number' ? input.application.monthlyObligations : simulation.application.monthlyObligations,
    requestedAmount: typeof input.application.requestedAmount === 'number' ? input.application.requestedAmount : simulation.application.requestedAmount,
    loanTenureMonths: typeof input.application.loanTenureMonths === 'number' ? input.application.loanTenureMonths : simulation.application.loanTenureMonths,
  } : simulation.application;
  const saved = repository.saveApplication(simulationId, application, isObject(input.declaredEmployment) && typeof input.declaredEmployment.employer === 'string' ? { employer: input.declaredEmployment.employer } : undefined) ?? simulation;
  return c.json({ schemaVersion: API_SCHEMA_VERSION, application: saved, generatedAt: new Date().toISOString() }, 201);
});

protectedApi.get('/api/applications/:simulationId', (c) => {
  const simulation = ownedSimulation(c.req.param('simulationId'), c.get('principal')!.clerkUserId);
  if (!simulation) return forbidden();
  return c.json({ schemaVersion: API_SCHEMA_VERSION, application: simulation, generatedAt: new Date().toISOString() });
});

protectedApi.get('/api/demo/applicants', (c) => {
  const principal = c.get('principal')!.clerkUserId;
  const ownedApplicantIds = new Set(repository.listSimulations().filter((simulation) => simulation.clerkUserId === principal && repository.listConsents(simulation.simulationId).some((receipt) => receipt.status === 'granted')).map((simulation) => simulation.applicantId));
  const applicants = repository.listApplicants().filter((applicant) => ownedApplicantIds.has(applicant.applicantId));
  if (applicants.length === 0) return errorResponse('CONSENT_REQUIRED', 'Consent is required before applicant data is available.', generateRequestId(), 403);
  return c.json({ schemaVersion: API_SCHEMA_VERSION, applicants: applicants.map((item) => ({ applicantId: item.applicantId, displayName: item.displayName, fixtureId: item.applicantId, source: 'synthetic_fixture' as const, baseline: item.baseline, alternative: item.alternative, provenance: item.provenance })), generatedAt: new Date().toISOString() });
});

protectedApi.get('/api/consent', (c) => {
  const simulationId = c.req.query('simulationId');
  const principal = c.get('principal')!.clerkUserId;
  if (!simulationId) return validationFailure(c, 'unknown', principal);
  if (!ownedSimulation(simulationId, principal)) return forbidden();
  return c.json({ schemaVersion: API_SCHEMA_VERSION, receipts: repository.listConsents(simulationId), generatedAt: new Date().toISOString() });
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
  const existing = repository.getSimulation(simulationId);
  if (existing && (existing.clerkUserId !== principal || existing.applicantId !== applicantId)) return forbidden();
  const now = new Date().toISOString();
  const receiptWithoutHash = { schemaVersion: '1.1' as const, consentId: `con-${crypto.randomUUID()}`, simulationId, applicantId, purposes: purposes as ConsentPurpose[], categories, source: input.source as 'synthetic_fixture' | 'consented_manual_entry', status: 'granted' as const, grantedAt: now, revokedAt: null, retention: 'demo_session' as const, identityProvider: 'clerk' as const, clerkUserId: principal };
  const receipt: ConsentReceipt = { ...receiptWithoutHash, receiptHash: await receiptHash(receiptWithoutHash) };
  repository.ensureSimulation(simulationId, principal, applicantId);
  repository.saveConsent(receipt);
  const event = audit(simulationId, applicantId, 'consent', principal, { mutation: 'grant' });
  event.consentIds.push(receipt.consentId);
  return c.json({ schemaVersion: API_SCHEMA_VERSION, receipt, auditEventId: event.eventId, generatedAt: now }, 201);
});

protectedApi.post('/api/consent/:consentId/revoke', async (c) => {
  const principal = c.get('principal')!.clerkUserId;
  const receipt = repository.getConsent(c.req.param('consentId'));
  if (!receipt) return errorResponse('NOT_FOUND', 'Consent receipt not found.', generateRequestId(), 404);
  if (receipt.clerkUserId !== principal) return forbidden();
  if (!(await verifyReceiptHash(receipt))) return errorResponse('CONFLICT', 'Persisted consent receipt could not be verified.', generateRequestId(), 409);
  const revokedWithoutHash = { ...receipt, status: 'revoked' as const, revokedAt: new Date().toISOString() };
  const revoked = { ...revokedWithoutHash, receiptHash: await receiptHash(revokedWithoutHash) };
  repository.saveConsent(revoked);
  const event = audit(receipt.simulationId, receipt.applicantId, 'consent', principal, { mutation: 'revoke' });
  event.consentIds.push(receipt.consentId);
  return c.json({ schemaVersion: API_SCHEMA_VERSION, receipt: revoked, auditEventId: event.eventId, generatedAt: new Date().toISOString() });
});

protectedApi.get('/api/providers', (c) => {
  const simulationId = c.req.query('simulationId');
  const principal = c.get('principal')!.clerkUserId;
  if (!simulationId) return validationFailure(c, 'unknown', principal);
  const simulation = ownedSimulation(simulationId, principal);
  if (!simulation) return forbidden();
  return c.json({ schemaVersion: API_SCHEMA_VERSION, providers: ['account_aggregator', 'digilocker_employment', 'digilocker_education'].map((source) => ({ source, connected: Boolean(simulation.providers[source as keyof typeof simulation.providers]), provenance: simulation.providers[source as keyof typeof simulation.providers]?.provenance ?? null })), generatedAt: new Date().toISOString() });
});

protectedApi.post('/api/providers/:source/connect', async (c) => {
  const principal = c.get('principal')!.clerkUserId;
  const input = await body(c);
  const simulationId = input && requiredString(input, 'simulationId');
  const consentId = input && requiredString(input, 'consentId');
  const simulation = simulationId ? ownedSimulation(simulationId, principal) : undefined;
  const consent = consentId ? repository.getConsent(consentId) : undefined;
  if (!input || !simulationId || !simulation || !consentId || !consent || consent.clerkUserId !== principal || consent.simulationId !== simulationId || consent.status !== 'granted' || !(await verifyReceiptHash(consent))) return errorResponse('CONSENT_REQUIRED', 'Provider consent is required.', generateRequestId(), 403);
  const source = c.req.param('source');
  if (source === 'account_aggregator') {
    if (!consent.purposes.includes('alternative_cashflow')) return errorResponse('CONSENT_REQUIRED', 'Provider consent is required.', generateRequestId(), 403);
    const response = new MockAccountAggregatorProvider().fetch({ persona: input.persona === 'stable_salaried' ? 'stable_salaried' : input.persona === 'anomaly_heavy' ? 'anomaly_heavy' : 'irregular_income', consent: { source, purpose: 'cashflow_analysis', scopes: ['account_transactions'], timestamp: consent.grantedAt, consentReference: consent.consentId } });
    repository.saveProvider(simulationId, 'account_aggregator', response);
    return c.json({ schemaVersion: API_SCHEMA_VERSION, data: response.data, provenance: response.provenance, consentReference: response.consent.consentReference, generatedAt: new Date().toISOString() });
  }
  if (source === 'digilocker_employment' || source === 'digilocker_education') {
    if (source === 'digilocker_employment') {
      const response = new MockDigiLockerProvider().fetch({ recordType: 'employment', consent: { source, purpose: 'employment_verification', scopes: ['employment_records'], timestamp: consent.grantedAt, consentReference: consent.consentId } });
      repository.saveProvider(simulationId, source, response);
      return c.json({ schemaVersion: API_SCHEMA_VERSION, data: response.data, provenance: response.provenance, consentReference: response.consent.consentReference, generatedAt: new Date().toISOString() });
    }
    const response = new MockDigiLockerProvider().fetch({ recordType: 'education', consent: { source, purpose: 'education_verification', scopes: ['education_records'], timestamp: consent.grantedAt, consentReference: consent.consentId } });
    repository.saveProvider(simulationId, source, response);
    return c.json({ schemaVersion: API_SCHEMA_VERSION, data: response.data, provenance: response.provenance, consentReference: response.consent.consentReference, generatedAt: new Date().toISOString() });
  }
  return errorResponse('NOT_FOUND', 'Provider not found.', generateRequestId(), 404);
});

protectedApi.post('/api/score', async (c) => {
  const principal = c.get('principal')!.clerkUserId;
  const input = await body(c);
  const simulationId = input && requiredString(input, 'simulationId');
  const applicantId = input && requiredString(input, 'applicantId');
  const mode = input?.mode;
  const existingSimulation = simulationId ? repository.getSimulation(simulationId) : undefined;
  if (existingSimulation && (existingSimulation.clerkUserId !== principal || (applicantId && existingSimulation.applicantId !== applicantId))) return forbidden();
  const simulation = simulationId && applicantId ? boundSimulation(simulationId, applicantId, principal) : undefined;
  if (!input || !simulationId || !applicantId || !simulation || (mode !== 'baseline_only' && mode !== 'consented_dynamic')) return validationFailure(c, simulationId ?? 'unknown', principal);
  if (!(await receiptsAreValid(simulationId))) return errorResponse('CONFLICT', 'Persisted consent receipt could not be verified.', generateRequestId(), 409);
  const baselineConsent = activeConsent(simulationId, 'application_baseline');
  if (!baselineConsent) return errorResponse('CONSENT_REQUIRED', 'Application-baseline consent is required.', generateRequestId(), 403);
  if (mode === 'consented_dynamic') {
    const alternativeConsent = activeConsent(simulationId, 'alternative_cashflow');
    if (alternativeConsent) await ensureDynamicProvider(simulation, alternativeConsent);
  }
  const engineResult = scoreApplication(engineInput(simulation, mode));
  const event = audit(simulationId, applicantId, 'score', principal, { mode });
  event.consentIds.push(...repository.listConsents(simulationId).filter((receipt) => receipt.status === 'granted').map((receipt) => receipt.consentId));
  event.provenanceRefs.push(...engineResult.features.sourceReferences);
  const result = toScoreResult(simulationId, applicantId, engineResult, event.eventId);
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
  const existingSimulation = simulationId ? repository.getSimulation(simulationId) : undefined;
  if (existingSimulation && (existingSimulation.clerkUserId !== principal || (applicantId && existingSimulation.applicantId !== applicantId))) return forbidden();
  const simulation = simulationId && applicantId ? boundSimulation(simulationId, applicantId, principal) : undefined;
  const consent = consentId ? repository.getConsent(consentId) : undefined;
  if (!input || !simulationId || !applicantId || !consentId || !eventType || !['income_observation', 'payment_observation', 'savings_observation'].includes(eventType) || value === undefined || !simulation) return validationFailure(c, simulationId ?? 'unknown', principal);
  if (!(await receiptsAreValid(simulationId)) || !consent || consent.clerkUserId !== principal || consent.simulationId !== simulationId || consent.applicantId !== applicantId || consent.status !== 'granted' || !consent.purposes.includes('behavior_updates')) return errorResponse('CONSENT_REQUIRED', 'Behavior-update consent is required.', generateRequestId(), 403);
  const update = { updateId: `behavior-${crypto.randomUUID()}`, simulationId, applicantId, eventType: eventType as 'income_observation' | 'payment_observation' | 'savings_observation', value, observedAt: new Date().toISOString(), source: 'synthetic_fixture' as const, consentId };
  repository.saveBehavior(update);
  const behaviorEvent = audit(simulationId, applicantId, 'behavior_update', principal, { eventType, value });
  behaviorEvent.consentIds.push(consentId);
  const engineUpdate: EngineBehaviorUpdate = { updateId: update.updateId, eventType: update.eventType, value, observedAt: update.observedAt, source: 'synthetic_behavior', consentReference: consentId, provenance: `behavior:${update.updateId}` };
  const recalculated = recalculateWithBehaviorUpdate(engineInput(simulation, 'consented_dynamic'), engineUpdate);
  const scoreEvent = audit(simulationId, applicantId, 'score', principal, { mode: 'consented_dynamic', behaviorUpdateId: update.updateId });
  scoreEvent.consentIds.push(consentId);
  scoreEvent.provenanceRefs.push(...recalculated.result.features.sourceReferences);
  const result = toScoreResult(simulationId, applicantId, recalculated.result, scoreEvent.eventId);
  repository.saveScore(result);
  return c.json({ schemaVersion: API_SCHEMA_VERSION, result, update, auditEventId: scoreEvent.eventId, behaviorAuditEventId: behaviorEvent.eventId, generatedAt: result.generatedAt });
});

protectedApi.post('/api/fairness', async (c) => {
  const principal = c.get('principal')!.clerkUserId;
  const input = await body(c);
  const simulationId = input && requiredString(input, 'simulationId');
  if (!input || !simulationId) return validationFailure(c, simulationId ?? 'unknown', principal);
  const existingSimulation = repository.getSimulation(simulationId);
  if (existingSimulation && existingSimulation.clerkUserId !== principal) return forbidden();
  const simulation = existingSimulation ?? repository.ensureSimulation(simulationId, principal, 'app-hero');
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
