import type { EvidenceItem, FairnessReport, RiskBand, ScoreResult } from '@underwriting/shared';
import type { ApiApplication } from './api.ts';
import { auditEvents, fairness, score } from './fixtures.ts';

export type ProviderState = 'Not connected' | 'Consent required' | 'Connecting' | 'Connected' | 'Error';
export type DataSourceKey = 'accountAggregator' | 'employmentDigiLocker' | 'educationDigiLocker' | 'professional';
export type SourceRecord = { consent: boolean; state: ProviderState };
export type SourceMap = Record<DataSourceKey, SourceRecord>;
export type ApplicationDraft = {
  applicantName: string; address: string; employmentType: string; employer: string; jobTitle: string;
  employmentTenure: number; monthlyIncome: number; monthlyObligations: number; educationCredential: string;
  requestedAmount: number; repaymentTenure: number; bureauScore: number; purpose: string; sources: SourceMap;
};
export type ApplicationReview = {
  score: ScoreResult; fairness: FairnessReport | null; evidence: EvidenceItem[]; alternativeAvailable: boolean;
  explanation: string; timeline: Array<{ label: string; detail: string; time: string }>;
  sourceComparison: Array<{ label: string; baseline: string; alternative: string }>;
};
export type ApplicationRecord = { id: string; synthetic: true; example?: boolean; status: 'Draft' | 'Processing' | 'Reviewed' | 'Needs attention'; createdAt: string; updatedAt: string; draft: ApplicationDraft; review: ApplicationReview | null; apiApplication?: ApiApplication };

export const sourceCatalog: Array<{ key: DataSourceKey; name: string; provider: string; purpose: string; scope: string; optional: boolean }> = [
  { key: 'accountAggregator', name: 'Financial account data', provider: 'Mock Account Aggregator', purpose: 'Understand synthetic cash-flow consistency.', scope: 'Balances, income credits, recurring obligations', optional: true },
  { key: 'employmentDigiLocker', name: 'Employment verification', provider: 'Mock DigiLocker', purpose: 'Compare self-declared employment with a synthetic credential.', scope: 'Employer, title, tenure', optional: true },
  { key: 'educationDigiLocker', name: 'Education verification', provider: 'Mock DigiLocker', purpose: 'Compare the self-declared education credential with a synthetic record.', scope: 'Credential and issuing institution', optional: true },
  { key: 'professional', name: 'Professional data', provider: 'Future connector', purpose: 'A future connector could add professional context.', scope: 'Not requested in this demo', optional: true },
];

const STORAGE_KEY = 'synthetic-loan-applications-v2';
const timestamp = () => new Date().toISOString();
let memory: ApplicationRecord[] = [];
const emptySources = (): SourceMap => ({ accountAggregator: { consent: false, state: 'Not connected' }, employmentDigiLocker: { consent: false, state: 'Not connected' }, educationDigiLocker: { consent: false, state: 'Not connected' }, professional: { consent: false, state: 'Not connected' } });

function read(): ApplicationRecord[] { try { const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return memory; const parsed = JSON.parse(raw) as { version: 2; applications: ApplicationRecord[] }; memory = parsed.version === 2 && Array.isArray(parsed.applications) ? parsed.applications : []; } catch { /* use memory when browser storage is unavailable */ } return memory; }
function write(applications: ApplicationRecord[]): void { memory = applications; try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, applications })); } catch { /* memory fallback */ } }
function id(prefix = 'app') { return `${prefix}-${crypto.randomUUID()}`; }

function exampleDraft(): ApplicationDraft { return { applicantName: 'Synthetic salaried applicant', address: 'Demo address, not a real person', employmentType: 'Salaried', employer: 'Example Holdings', jobTitle: 'Operations analyst', employmentTenure: 46, monthlyIncome: 92000, monthlyObligations: 28000, educationCredential: 'Bachelor of Commerce', requestedAmount: 240000, repaymentTenure: 36, bureauScore: 742, purpose: 'Home improvement', sources: { accountAggregator: { consent: true, state: 'Connected' }, employmentDigiLocker: { consent: true, state: 'Connected' }, educationDigiLocker: { consent: true, state: 'Connected' }, professional: { consent: false, state: 'Not connected' } } }; }

function reviewFor(draft: ApplicationDraft, applicationId: string, example = false): ApplicationReview {
  const alternativeAvailable = Object.values(draft.sources).some((source) => source.state === 'Connected');
  const baseline = example ? score.baselineScore : Math.min(99, Math.max(1, Math.round(draft.bureauScore / 10)));
  const dynamic = example ? score.dynamicScore : baseline + (alternativeAvailable ? 5 : 0);
  const safeScore = Math.min(99, dynamic);
  const riskBand: RiskBand = safeScore >= 80 ? 'strong' : safeScore >= 65 ? 'stable' : safeScore >= 50 ? 'guarded' : 'watch';
  const result = example ? score : { ...score, simulationId: applicationId, scoreId: `score-${applicationId}`, applicantId: applicationId, baselineScore: baseline, alternativeContribution: safeScore - baseline, dynamicScore: safeScore, riskBand, generatedAt: timestamp(), auditEventId: `audit-${applicationId}`, evidence: [] };
  const evidence = example ? score.evidence : [{ ...score.evidence[0], featureKey: 'self_declared_bureau', label: 'Self-declared bureau score', signedPoints: 0, direction: 'neutral' as const, source: 'consented_manual_entry' as const, consentId: null, explanation: 'The score was entered as self-declared application data.', provenanceRef: applicationId }];
  return { score: { ...result, evidence }, fairness: { ...fairness, reportId: `fairness-${applicationId}`, generatedAt: timestamp() }, evidence, alternativeAvailable, explanation: alternativeAvailable ? 'The assessment combines self-declared baseline data with connected mock source states. This is a local assessment, not a lending decision.' : 'The assessment uses self-declared baseline data only. Optional alternative data was not connected, and the application was not penalized for that choice.', timeline: example ? auditEvents.map((event) => ({ label: event.eventType === 'consent' ? 'Consent recorded' : 'Assessment completed', detail: 'Local connector activity placeholder.', time: event.occurredAt })) : [{ label: 'Application submitted', detail: 'Self-declared application metadata saved locally.', time: timestamp() }, { label: 'Assessment completed', detail: 'Deterministic local assessment generated this review state.', time: timestamp() }], sourceComparison: sourceCatalog.map((source) => ({ label: source.name, baseline: source.key === 'employmentDigiLocker' ? draft.employer : source.key === 'educationDigiLocker' ? draft.educationCredential : 'Self-declared', alternative: draft.sources[source.key].state === 'Connected' ? 'Connected mock source' : 'Not connected' })) };
}

export function createApplicationAdapter() {
  return {
    list: () => [...read()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    get: (applicationId: string) => read().find((application) => application.id === applicationId) ?? null,
    saveDraft: (draft: ApplicationDraft, existingId?: string): ApplicationRecord => { const applications = read(); const existing = existingId ? applications.find((item) => item.id === existingId) : undefined; const record: ApplicationRecord = { id: existing?.id ?? id(), synthetic: true, status: 'Draft', createdAt: existing?.createdAt ?? timestamp(), updatedAt: timestamp(), draft, review: null }; write(existing ? applications.map((item) => item.id === record.id ? record : item) : [...applications, record]); return record; },
    review: (draft: ApplicationDraft, existingId?: string): ApplicationRecord => { const saved = createApplicationAdapter().saveDraft(draft, existingId); const reviewed = { ...saved, status: 'Reviewed' as const, updatedAt: timestamp(), review: reviewFor(draft, saved.id) }; write(read().map((item) => item.id === saved.id ? reviewed : item)); return reviewed; },
    updateSource: (applicationId: string, sourceKey: DataSourceKey, consent: boolean): ApplicationRecord => { const current = read().find((item) => item.id === applicationId); if (!current) throw new Error('Application not found.'); const updated: ApplicationRecord = { ...current, updatedAt: timestamp(), draft: { ...current.draft, sources: { ...current.draft.sources, [sourceKey]: { consent, state: consent ? 'Connected' : 'Not connected' } } } }; write(read().map((item) => item.id === applicationId ? updated : item)); return updated; },
    createSyntheticExample: (): ApplicationRecord => { const draft = exampleDraft(); const record: ApplicationRecord = { id: id('example'), synthetic: true, example: true, status: 'Reviewed', createdAt: timestamp(), updatedAt: timestamp(), draft, review: reviewFor(draft, 'example', true) }; write([...read(), record]); return record; },
  };
}

export { emptySources };
