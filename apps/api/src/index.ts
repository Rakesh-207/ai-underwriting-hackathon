import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppBindings } from './env.ts';
import {
  API_SCHEMA_VERSION,
  type AuditEvent,
  type ConsentPurpose,
  type ConsentReceipt,
  type EvidenceItem,
  type ProvenanceRecord,
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
import { repositoryFor, type ProviderSource, type SimulationRecord, type SimulationRepository } from './repository.ts';
import { receiptHash, verifyReceiptHash } from './receipt-hash.ts';
import { MockAccountAggregatorProvider, MockDigiLockerProvider, type AccountAggregatorPersona } from './providers/index.ts';
import { isObject, requiredString, requiredStringArray, validateConsent, type JsonObject } from './validation.ts';

const app = new Hono<AppBindings>();
app.use('*', cors());

app.get('/api/health', (c) => c.json({
  schemaVersion: API_SCHEMA_VERSION,
  status: 'ok',
  service: 'underwriting-simulation-api',
  repository: c.env.DB ? 'd1' : 'memory',
  modelVersion: 'scorecard-v1',
  generatedAt: new Date().toISOString(),
}));

const protectedApi = new Hono<AppBindings>();
protectedApi.use('*', requireAuth());

function forbidden() {
  return errorResponse('FORBIDDEN', 'You do not own this application.', generateRequestId(), 403);
}

async function body(c: Context<AppBindings>): Promise<JsonObject | null> {
  try {
    const parsed: unknown = await c.req.json();
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function audit(
  repo: SimulationRepository,
  simulationId: string,
  applicantId: string,
  eventType: AuditEvent['eventType'],
  principal: string,
  detail: Record<string, string | number | boolean> = {},
): Promise<AuditEvent> {
  const event: AuditEvent = {
    schemaVersion: API_SCHEMA_VERSION,
    eventId: `audit-${crypto.randomUUID()}`,
    simulationId,
    applicantId,
    clerkUserId: principal,
    eventType,
    occurredAt: new Date().toISOString(),
    modelVersion: eventType === 'score' ? 'scorecard-v1' : null,
    featureRegistryVersion: eventType === 'score' ? 'engine-v1' : null,
    consentIds: [],
    provenanceRefs: [],
    detail: { ...detail, actor: principal },
  };
  await repo.addAudit(event);
  return event;
}

async function validationFailure(
  repo: SimulationRepository,
  c: Context<AppBindings>,
  simulationId: string,
  principal: string,
  fields: Record<string, string[]> = {},
) {
  await audit(repo, simulationId, 'unknown', 'validation_failure', principal, { route: c.req.path });
  return errorResponse('VALIDATION_ERROR', 'Request validation failed.', generateRequestId(), 400, fields);
}

async function ownedSimulation(repo: SimulationRepository, simulationId: string, principal: string) {
  const simulation = await repo.getSimulation(simulationId);
  return simulation?.clerkUserId === principal ? simulation : undefined;
}

async function boundSimulation(repo: SimulationRepository, simulationId: string, applicantId: string, principal: string) {
  const simulation = await ownedSimulation(repo, simulationId, principal);
  return simulation?.applicantId === applicantId ? simulation : undefined;
}

function sourceConsent(receipts: ConsentReceipt[], source: ProviderSource): ConsentReceipt | undefined {
  const categories: Record<ProviderSource, string[]> = {
    account_aggregator: ['cashflow', 'account_transactions', 'account_aggregator'],
    digilocker_employment: ['employment', 'employment_records', 'digilocker_employment'],
    digilocker_education: ['education', 'education_records', 'digilocker_education'],
  };
  return receipts.find((receipt) => receipt.status === 'granted'
    && receipt.categories.some((category) => categories[source].includes(category))
    && (source === 'account_aggregator' ? receipt.purposes.includes('alternative_cashflow')
      : source === 'digilocker_employment' || source === 'digilocker_education'
        ? receipt.purposes.includes('alternative_cashflow')
        : false));
}

function activePurposeConsent(receipts: ConsentReceipt[], purpose: ConsentPurpose) {
  return receipts.find((receipt) => receipt.status === 'granted' && receipt.purposes.includes(purpose));
}

async function receiptsAreValid(repo: SimulationRepository, simulationId: string) {
  const receipts = await repo.listConsents(simulationId);
  const validity = await Promise.all(receipts.map((receipt) => verifyReceiptHash(receipt)));
  return validity.every(Boolean);
}

function engineConsentSource(receipt: ConsentReceipt): 'account_aggregator' | 'digilocker_employment' | 'digilocker_education' {
  if (receipt.categories.some((category) => ['employment', 'employment_records', 'digilocker_employment'].includes(category))) return 'digilocker_employment';
  if (receipt.categories.some((category) => ['education', 'education_records', 'digilocker_education'].includes(category))) return 'digilocker_education';
  return 'account_aggregator';
}

async function engineInput(repo: SimulationRepository, simulation: SimulationRecord, mode: 'baseline_only' | 'consented_dynamic'): Promise<UnderwritingEngineInput> {
  const receipts = await repo.listConsents(simulation.simulationId);
  const behaviorUpdates: EngineBehaviorUpdate[] = simulation.behaviorUpdates.map((update) => ({
    updateId: update.updateId,
    eventType: update.eventType,
    value: update.value,
    observedAt: update.observedAt,
    source: 'synthetic_behavior',
    consentReference: update.consentId,
    provenance: `behavior:${update.updateId}`,
  }));
  return {
    applicantId: simulation.applicantId,
    application: simulation.application,
    declaredEmployment: simulation.declaredEmployment,
    accountAggregator: mode === 'consented_dynamic' && sourceConsent(receipts, 'account_aggregator')
      ? simulation.providers.account_aggregator as UnderwritingEngineInput['accountAggregator'] : undefined,
    employment: mode === 'consented_dynamic' && sourceConsent(receipts, 'digilocker_employment')
      ? simulation.providers.digilocker_employment as UnderwritingEngineInput['employment'] : undefined,
    education: mode === 'consented_dynamic' && sourceConsent(receipts, 'digilocker_education')
      ? simulation.providers.digilocker_education as UnderwritingEngineInput['education'] : undefined,
    behaviorUpdates: mode === 'consented_dynamic' ? behaviorUpdates : [],
    consentReceipts: receipts.map((receipt) => ({
      source: engineConsentSource(receipt),
      consentReference: receipt.consentId,
      purpose: receipt.purposes.join(','),
      timestamp: receipt.grantedAt,
      provenanceReferences: [],
    })),
  };
}

function resultProvenance(simulation: SimulationRecord, receipts: ConsentReceipt[]): ProvenanceRecord[] {
  const providerRecords: ProvenanceRecord[] = Object.entries(simulation.providers).filter(([, response]) => response && receipts.some((receipt) => receipt.status === 'granted' && receipt.consentId === response.consent.consentReference)).map(([source, response]) => ({
    source: 'synthetic_fixture' as const,
    fixtureId: response?.provenance.reference ?? source,
    fixtureVersion: 'v1',
    category: source,
    purpose: 'alternative_cashflow' as const,
    consentId: response?.consent.consentReference ?? null,
    capturedAt: response?.provenance.retrievedAt ?? new Date().toISOString(),
  }));
  const consentRecords: ProvenanceRecord[] = receipts.filter((receipt) => receipt.purposes.includes('application_baseline')).map((receipt) => ({
    source: receipt.source,
    fixtureId: receipt.applicantId,
    fixtureVersion: 'v1',
    category: 'application_baseline',
    purpose: 'application_baseline' as const,
    consentId: receipt.consentId,
    capturedAt: receipt.grantedAt,
  }));
  return providerRecords.concat(consentRecords);
}

function toScoreResult(simulation: SimulationRecord, result: UnderwritingScoreResult, auditEventId: string, receipts: ConsentReceipt[]): ScoreResult {
  const evidence: EvidenceItem[] = result.evidence.map((item) => ({
    featureKey: item.id,
    label: item.label,
    normalizedValue: item.scoreContribution,
    signedPoints: item.scoreContribution,
    direction: item.direction,
    source: 'synthetic_fixture',
    consentId: item.consentReference === 'not_applicable' ? null : item.consentReference,
    explanation: item.explanation,
    provenanceRef: item.provenance,
  }));
  const riskBand = result.riskBand === 'strong' ? 'strong' : result.riskBand === 'moderate' ? 'stable' : 'watch';
  return {
    schemaVersion: API_SCHEMA_VERSION,
    simulationId: simulation.simulationId,
    scoreId: result.scoreId,
    applicantId: simulation.applicantId,
    baselineScore: result.baselineScore,
    alternativeContribution: result.alternativeContribution,
    dynamicScore: result.dynamicScore,
    riskBand,
    scoreMeaning: 'higher_is_stronger_reliability',
    evidence,
    provenance: resultProvenance(simulation, receipts),
    fraudReview: {
      status: result.anomalies.length ? 'review' : 'clear',
      flags: result.anomalies.map((anomaly) => ({ ruleKey: anomaly.id, severity: anomaly.severity, explanation: anomaly.explanation })),
      action: result.anomalies.length ? 'manual_review' : 'none',
      ruleVersion: 'engine-v1',
    },
    modelVersion: 'underwriting-engine-v1',
    featureRegistryVersion: 'underwriting-engine-v1',
    generatedAt: result.generatedAt,
    auditEventId,
    costEstimate: { modelComputeMs: 0, dataAccess: 0, storageWrite: 1, explanation: 0, currency: 'USD', estimatedAmount: 0, basis: 'local_measurement' },
  };
}

async function ensureAccountAggregator(repo: SimulationRepository, simulation: SimulationRecord, receipt: ConsentReceipt) {
  if (simulation.providers.account_aggregator) return;
  const persona: AccountAggregatorPersona = simulation.applicantId === 'app-hero' ? 'stable_salaried' : 'irregular_income';
  const response = new MockAccountAggregatorProvider().fetch({
    persona,
    consent: { source: 'account_aggregator', purpose: 'cashflow_analysis', scopes: ['account_transactions'], timestamp: receipt.grantedAt, consentReference: receipt.consentId },
  });
  await repo.saveProvider(simulation.simulationId, 'account_aggregator', response);
}

protectedApi.get('/api/applications', async (c) => {
  const repo = repositoryFor(c.env);
  const principal = c.get('principal')!.clerkUserId;
  const applications = (await repo.listSimulations()).filter((item) => item.clerkUserId === principal);
  return c.json({ schemaVersion: API_SCHEMA_VERSION, applications, generatedAt: new Date().toISOString() });
});

protectedApi.post('/api/applications', async (c) => {
  const repo = repositoryFor(c.env);
  const principal = c.get('principal')!.clerkUserId;
  const input = await body(c);
  const simulationId = input && requiredString(input, 'simulationId');
  const applicantId = input && requiredString(input, 'applicantId');
  const applicant = applicantId && repo.listApplicants().find((item) => item.applicantId === applicantId);
  if (!input || !simulationId || !applicantId || !applicant) return validationFailure(repo, c, simulationId ?? 'unknown', principal);
  const existing = await repo.getSimulation(simulationId);
  if (existing && (existing.clerkUserId !== principal || existing.applicantId !== applicantId)) return forbidden();
  const simulation = await repo.ensureSimulation(simulationId, principal, applicantId);
  const applicationInput = isObject(input.application) ? input.application : {};
  const application = {
    bureauScore: typeof applicationInput.bureauScore === 'number' ? applicationInput.bureauScore : simulation.application.bureauScore,
    monthlyIncome: typeof applicationInput.monthlyIncome === 'number' ? applicationInput.monthlyIncome : simulation.application.monthlyIncome,
    monthlyObligations: typeof applicationInput.monthlyObligations === 'number' ? applicationInput.monthlyObligations : simulation.application.monthlyObligations,
    requestedAmount: typeof applicationInput.requestedAmount === 'number' ? applicationInput.requestedAmount : simulation.application.requestedAmount,
    loanTenureMonths: typeof applicationInput.loanTenureMonths === 'number' ? applicationInput.loanTenureMonths : simulation.application.loanTenureMonths,
  };
  const declaredEmployment = isObject(input.declaredEmployment) && typeof input.declaredEmployment.employer === 'string' ? { employer: input.declaredEmployment.employer } : undefined;
  const saved = await repo.saveApplication(simulationId, application, declaredEmployment) ?? simulation;
  return c.json({ schemaVersion: API_SCHEMA_VERSION, application: saved, generatedAt: new Date().toISOString() }, 201);
});

protectedApi.get('/api/applications/:simulationId', async (c) => {
  const repo = repositoryFor(c.env);
  const simulation = await ownedSimulation(repo, c.req.param('simulationId'), c.get('principal')!.clerkUserId);
  if (!simulation) return forbidden();
  return c.json({ schemaVersion: API_SCHEMA_VERSION, application: simulation, generatedAt: new Date().toISOString() });
});

protectedApi.get('/api/demo/applicants', async (c) => {
  const repo = repositoryFor(c.env);
  const principal = c.get('principal')!.clerkUserId;
  const simulations = (await repo.listSimulations()).filter((simulation) => simulation.clerkUserId === principal);
  const ownedApplicantIds = new Set((await Promise.all(simulations.map(async (simulation) => (await repo.listConsents(simulation.simulationId)).some((receipt) => receipt.status === 'granted')))).flatMap((hasConsent, index) => hasConsent ? [simulations[index].applicantId] : []));
  const applicants = repo.listApplicants().filter((applicant) => ownedApplicantIds.has(applicant.applicantId));
  if (applicants.length === 0) return errorResponse('CONSENT_REQUIRED', 'Consent is required before applicant data is available.', generateRequestId(), 403);
  return c.json({ schemaVersion: API_SCHEMA_VERSION, applicants: applicants.map((item) => ({ applicantId: item.applicantId, displayName: item.displayName, fixtureId: item.applicantId, source: 'synthetic_fixture' as const, baseline: item.baseline, alternative: item.alternative, provenance: item.provenance })), generatedAt: new Date().toISOString() });
});

protectedApi.get('/api/consent', async (c) => {
  const repo = repositoryFor(c.env);
  const principal = c.get('principal')!.clerkUserId;
  const simulationId = c.req.query('simulationId');
  if (!simulationId) return validationFailure(repo, c, 'unknown', principal);
  if (!(await ownedSimulation(repo, simulationId, principal))) return forbidden();
  return c.json({ schemaVersion: API_SCHEMA_VERSION, receipts: await repo.listConsents(simulationId), generatedAt: new Date().toISOString() });
});

protectedApi.post('/api/consent', async (c) => {
  const repo = repositoryFor(c.env);
  const principal = c.get('principal')!.clerkUserId;
  const input = await body(c);
  const parsed = validateConsent(input);
  const simulationId = input && requiredString(input, 'simulationId');
  const applicantId = input && requiredString(input, 'applicantId');
  const purposes = input && requiredStringArray(input, 'purposes');
  const categories = input && requiredStringArray(input, 'categories');
  if (!input || !simulationId || !applicantId || !purposes?.length || !categories?.length || !['synthetic_fixture', 'consented_manual_entry'].includes(String(input.source))) return validationFailure(repo, c, simulationId ?? 'unknown', principal, parsed.fieldErrors);
  if (!repo.listApplicants().some((item) => item.applicantId === applicantId)) return validationFailure(repo, c, simulationId, principal, { applicantId: ['Unknown synthetic applicant.'] });
  const existing = await repo.getSimulation(simulationId);
  if (existing && (existing.clerkUserId !== principal || existing.applicantId !== applicantId)) return forbidden();
  await repo.ensureSimulation(simulationId, principal, applicantId);
  const now = new Date().toISOString();
  const receiptWithoutHash = { schemaVersion: API_SCHEMA_VERSION, consentId: `con-${crypto.randomUUID()}`, simulationId, applicantId, purposes: purposes as ConsentPurpose[], categories, source: input.source as 'synthetic_fixture' | 'consented_manual_entry', status: 'granted' as const, grantedAt: now, revokedAt: null, retention: 'demo_session' as const, identityProvider: 'clerk' as const, clerkUserId: principal };
  const receipt: ConsentReceipt = { ...receiptWithoutHash, receiptHash: await receiptHash(receiptWithoutHash) };
  await repo.saveConsent(receipt);
  const event = await audit(repo, simulationId, applicantId, 'consent', principal, { mutation: 'grant' });
  event.consentIds.push(receipt.consentId);
  return c.json({ schemaVersion: API_SCHEMA_VERSION, receipt, auditEventId: event.eventId, generatedAt: now }, 201);
});

protectedApi.post('/api/consent/:consentId/revoke', async (c) => {
  const repo = repositoryFor(c.env);
  const principal = c.get('principal')!.clerkUserId;
  const receipt = await repo.getConsent(c.req.param('consentId'));
  if (!receipt) return errorResponse('NOT_FOUND', 'Consent receipt not found.', generateRequestId(), 404);
  const simulation = await ownedSimulation(repo, receipt.simulationId, principal);
  if (!simulation || receipt.clerkUserId !== principal) return forbidden();
  if (!(await verifyReceiptHash(receipt))) return errorResponse('CONFLICT', 'Persisted consent receipt could not be verified.', generateRequestId(), 409);
  if (receipt.status === 'revoked') return c.json({ schemaVersion: API_SCHEMA_VERSION, receipt, auditEventId: (await audit(repo, receipt.simulationId, receipt.applicantId, 'consent', principal, { mutation: 'revoke_repeat' })).eventId, generatedAt: new Date().toISOString() });
  const revokedWithoutHash = { ...receipt, status: 'revoked' as const, revokedAt: new Date().toISOString() };
  const revoked = { ...revokedWithoutHash, receiptHash: await receiptHash(revokedWithoutHash) };
  await repo.saveConsent(revoked);
  const event = await audit(repo, receipt.simulationId, receipt.applicantId, 'consent', principal, { mutation: 'revoke' });
  event.consentIds.push(receipt.consentId);
  return c.json({ schemaVersion: API_SCHEMA_VERSION, receipt: revoked, auditEventId: event.eventId, generatedAt: new Date().toISOString() });
});

protectedApi.get('/api/providers', async (c) => {
  const repo = repositoryFor(c.env);
  const principal = c.get('principal')!.clerkUserId;
  const simulationId = c.req.query('simulationId');
  if (!simulationId) return validationFailure(repo, c, 'unknown', principal);
  const simulation = await ownedSimulation(repo, simulationId, principal);
  if (!simulation) return forbidden();
  const sources: ProviderSource[] = ['account_aggregator', 'digilocker_employment', 'digilocker_education'];
  return c.json({ schemaVersion: API_SCHEMA_VERSION, providers: sources.map((source) => ({ source, connected: Boolean(simulation.providers[source]), provenance: simulation.providers[source]?.provenance ?? null })), generatedAt: new Date().toISOString() });
});

protectedApi.post('/api/providers/:source/connect', async (c) => {
  const repo = repositoryFor(c.env);
  const principal = c.get('principal')!.clerkUserId;
  const input = await body(c);
  const simulationId = input && requiredString(input, 'simulationId');
  const consentId = input && requiredString(input, 'consentId');
  const simulation = simulationId ? await ownedSimulation(repo, simulationId, principal) : undefined;
  const consent = consentId ? await repo.getConsent(consentId) : undefined;
  const source = c.req.param('source') as ProviderSource;
  if (!simulationId || !simulation || !consentId || !consent || consent.clerkUserId !== principal || consent.simulationId !== simulationId || consent.status !== 'granted' || !(await verifyReceiptHash(consent))) return errorResponse('CONSENT_REQUIRED', 'Provider consent is required.', generateRequestId(), 403);
  if (!['account_aggregator', 'digilocker_employment', 'digilocker_education'].includes(source)) return errorResponse('NOT_FOUND', 'Provider not found.', generateRequestId(), 404);
  const receipts = [consent];
  if (!sourceConsent(receipts, source)) return errorResponse('CONSENT_REQUIRED', 'Provider consent is required.', generateRequestId(), 403);
  if (source === 'account_aggregator') {
    const persona = input?.persona === 'stable_salaried' || input?.persona === 'anomaly_heavy' ? input.persona : 'irregular_income';
    const response = new MockAccountAggregatorProvider().fetch({ persona, consent: { source, purpose: 'cashflow_analysis', scopes: ['account_transactions'], timestamp: consent.grantedAt, consentReference: consent.consentId } });
    await repo.saveProvider(simulationId, source, response);
    return c.json({ schemaVersion: API_SCHEMA_VERSION, data: response.data, provenance: response.provenance, consentReference: response.consent.consentReference, generatedAt: new Date().toISOString() });
  }
  const recordType = source === 'digilocker_employment' ? 'employment' : 'education';
  const response = recordType === 'employment'
    ? new MockDigiLockerProvider().fetch({ recordType: 'employment', consent: { source, purpose: 'employment_verification', scopes: ['employment_records'], timestamp: consent.grantedAt, consentReference: consent.consentId } })
    : new MockDigiLockerProvider().fetch({ recordType: 'education', consent: { source, purpose: 'education_verification', scopes: ['education_records'], timestamp: consent.grantedAt, consentReference: consent.consentId } });
  await repo.saveProvider(simulationId, source, response);
  return c.json({ schemaVersion: API_SCHEMA_VERSION, data: response.data, provenance: response.provenance, consentReference: response.consent.consentReference, generatedAt: new Date().toISOString() });
});

protectedApi.post('/api/score', async (c) => {
  const repo = repositoryFor(c.env);
  const principal = c.get('principal')!.clerkUserId;
  const input = await body(c);
  const simulationId = input && requiredString(input, 'simulationId');
  const applicantId = input && requiredString(input, 'applicantId');
  const mode = input?.mode;
  const existing = simulationId ? await repo.getSimulation(simulationId) : undefined;
  if (existing && (existing.clerkUserId !== principal || (applicantId && existing.applicantId !== applicantId))) return forbidden();
  const simulation = simulationId && applicantId ? await boundSimulation(repo, simulationId, applicantId, principal) : undefined;
  if (!input || !simulationId || !applicantId || !simulation || (mode !== 'baseline_only' && mode !== 'consented_dynamic')) return validationFailure(repo, c, simulationId ?? 'unknown', principal);
  const receipts = await repo.listConsents(simulationId);
  if (!(await receiptsAreValid(repo, simulationId))) return errorResponse('CONFLICT', 'Persisted consent receipt could not be verified.', generateRequestId(), 409);
  if (!activePurposeConsent(receipts, 'application_baseline')) return errorResponse('CONSENT_REQUIRED', 'Application-baseline consent is required.', generateRequestId(), 403);
  if (mode === 'consented_dynamic') {
    const alternativeConsent = sourceConsent(receipts, 'account_aggregator');
    if (alternativeConsent) await ensureAccountAggregator(repo, simulation, alternativeConsent);
  }
  const current = await repo.getSimulation(simulationId) ?? simulation;
  const engineResult = scoreApplication(await engineInput(repo, current, mode));
  const event = await audit(repo, simulationId, applicantId, 'score', principal, { mode });
  event.consentIds.push(...receipts.filter((receipt) => receipt.status === 'granted').map((receipt) => receipt.consentId));
  event.provenanceRefs.push(...engineResult.features.sourceReferences);
  const result = toScoreResult(current, engineResult, event.eventId, receipts);
  await repo.saveScore(result);
  return c.json({ schemaVersion: API_SCHEMA_VERSION, result, generatedAt: result.generatedAt });
});

protectedApi.post('/api/behavior', async (c) => {
  const repo = repositoryFor(c.env);
  const principal = c.get('principal')!.clerkUserId;
  const input = await body(c);
  const simulationId = input && requiredString(input, 'simulationId');
  const applicantId = input && requiredString(input, 'applicantId');
  const consentId = input && requiredString(input, 'consentId');
  const eventType = input && requiredString(input, 'eventType');
  const value = input && typeof input.value === 'number' ? input.value : undefined;
  const existing = simulationId ? await repo.getSimulation(simulationId) : undefined;
  if (existing && (existing.clerkUserId !== principal || (applicantId && existing.applicantId !== applicantId))) return forbidden();
  const simulation = simulationId && applicantId ? await boundSimulation(repo, simulationId, applicantId, principal) : undefined;
  const consent = consentId ? await repo.getConsent(consentId) : undefined;
  if (!input || !simulationId || !applicantId || !consentId || !eventType || !['income_observation', 'payment_observation', 'savings_observation'].includes(eventType) || value === undefined || !simulation) return validationFailure(repo, c, simulationId ?? 'unknown', principal);
  const receipts = await repo.listConsents(simulationId);
  if (!(await receiptsAreValid(repo, simulationId)) || !activePurposeConsent(receipts, 'application_baseline') || !consent || consent.clerkUserId !== principal || consent.simulationId !== simulationId || consent.applicantId !== applicantId || consent.status !== 'granted' || !(await verifyReceiptHash(consent)) || !consent.purposes.includes('behavior_updates')) return errorResponse('CONSENT_REQUIRED', 'Behavior-update consent is required.', generateRequestId(), 403);
  const alternativeConsent = sourceConsent(receipts, 'account_aggregator');
  if (alternativeConsent) await ensureAccountAggregator(repo, simulation, alternativeConsent);
  const current = await repo.getSimulation(simulationId) ?? simulation;
  const update = { updateId: `behavior-${crypto.randomUUID()}`, simulationId, applicantId, eventType: eventType as 'income_observation' | 'payment_observation' | 'savings_observation', value, observedAt: new Date().toISOString(), source: 'synthetic_fixture' as const, consentId };
  const engineUpdate: EngineBehaviorUpdate = { updateId: update.updateId, eventType: update.eventType, value, observedAt: update.observedAt, source: 'synthetic_behavior', consentReference: consentId, provenance: `behavior:${update.updateId}` };
  const recalculated = recalculateWithBehaviorUpdate(await engineInput(repo, current, 'consented_dynamic'), engineUpdate);
  await repo.saveBehavior(update);
  const behaviorEvent = await audit(repo, simulationId, applicantId, 'behavior_update', principal, { eventType, value });
  behaviorEvent.consentIds.push(consentId);
  const scoreEvent = await audit(repo, simulationId, applicantId, 'score', principal, { mode: 'consented_dynamic', behaviorUpdateId: update.updateId });
  scoreEvent.consentIds.push(consentId);
  scoreEvent.provenanceRefs.push(...recalculated.result.features.sourceReferences);
  const result = toScoreResult(current, recalculated.result, scoreEvent.eventId, receipts);
  await repo.saveScore(result);
  return c.json({ schemaVersion: API_SCHEMA_VERSION, result, update, auditEventId: scoreEvent.eventId, behaviorAuditEventId: behaviorEvent.eventId, generatedAt: result.generatedAt });
});

protectedApi.post('/api/fairness', async (c) => {
  const repo = repositoryFor(c.env);
  const principal = c.get('principal')!.clerkUserId;
  const input = await body(c);
  const simulationId = input && requiredString(input, 'simulationId');
  if (!input || !simulationId) return validationFailure(repo, c, simulationId ?? 'unknown', principal);
  const existing = await repo.getSimulation(simulationId);
  if (existing && existing.clerkUserId !== principal) return forbidden();
  const simulation = existing ?? await repo.ensureSimulation(simulationId, principal, 'app-hero');
  const event = await audit(repo, simulationId, simulation.applicantId, 'fairness', principal, { datasetVersion: 'synthetic-cohort-v1' });
  const report = { schemaVersion: API_SCHEMA_VERSION, reportId: `fair-${crypto.randomUUID()}`, simulationId, datasetVersion: 'synthetic-cohort-v1', modelVersion: 'underwriting-engine-v1', referenceCohort: 'cohort_alpha', cohorts: [{ cohort: 'cohort_alpha', sampleCount: 10, strongOrStableRate: 0.7, outcomeRate: null, selectionRateRatio: 1, adverseImpactRatio: 1, sampleSizeWarning: 'Synthetic demonstration cohort; not a production fairness estimate.' }, { cohort: 'cohort_beta', sampleCount: 10, strongOrStableRate: 0.6, outcomeRate: null, selectionRateRatio: 0.86, adverseImpactRatio: 0.86, sampleSizeWarning: 'Synthetic demonstration cohort; not a production fairness estimate.' }], limitations: ['Synthetic evaluation only.', 'Fairness cohorts are not model inputs.'], generatedAt: new Date().toISOString(), auditEventId: event.eventId };
  return c.json({ schemaVersion: API_SCHEMA_VERSION, report, generatedAt: report.generatedAt });
});

protectedApi.get('/api/audit/:simulationId', async (c) => {
  const repo = repositoryFor(c.env);
  const principal = c.get('principal')!.clerkUserId;
  const simulation = await ownedSimulation(repo, c.req.param('simulationId'), principal);
  if (!simulation) return forbidden();
  return c.json({ schemaVersion: API_SCHEMA_VERSION, simulationId: simulation.simulationId, events: await repo.listAudit(simulation.simulationId), generatedAt: new Date().toISOString() });
});

app.route('/', protectedApi);
export default app;
