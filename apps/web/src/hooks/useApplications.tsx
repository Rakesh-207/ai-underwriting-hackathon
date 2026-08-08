import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createApiClient, type ApiApplication, type ApiProviderSource, type ApplicationInput, type TokenGetter } from '../lib/api.ts';
import type { ApplicationDraft, ApplicationRecord, DataSourceKey, SourceMap } from '../lib/applicationAdapter.ts';

type ApplicationsContextValue = {
  applications: ApplicationRecord[];
  loading: boolean;
  error: string | null;
  saveDraft: (draft: ApplicationDraft, id?: string) => Promise<ApplicationRecord>;
  runReview: (draft: ApplicationDraft, id?: string) => Promise<ApplicationRecord>;
  loadExample: () => Promise<ApplicationRecord>;
  find: (id: string) => ApplicationRecord | null;
  updateSource: (id: string, source: DataSourceKey, consent: boolean) => Promise<ApplicationRecord>;
  refresh: () => Promise<void>;
};

const ApplicationsContext = createContext<ApplicationsContextValue | null>(null);

const applicantNames: Record<string, string> = {
  'app-hero': 'Synthetic Applicant A',
  'app-review': 'Synthetic Applicant B',
};

function sourceMap(application: ApiApplication): SourceMap {
  const connected = (source: ApiProviderSource) => Boolean(application.providers[source]);
  return {
    accountAggregator: { consent: connected('account_aggregator'), state: connected('account_aggregator') ? 'Connected' : 'Not connected' },
    employmentDigiLocker: { consent: connected('digilocker_employment'), state: connected('digilocker_employment') ? 'Connected' : 'Not connected' },
    educationDigiLocker: { consent: connected('digilocker_education'), state: connected('digilocker_education') ? 'Connected' : 'Not connected' },
    professional: { consent: false, state: 'Not connected' },
  };
}

function toDraft(application: ApiApplication): ApplicationDraft {
  return {
    applicantName: applicantNames[application.applicantId] ?? application.applicantId,
    address: 'Synthetic fixture address',
    employmentType: 'Salaried',
    employer: application.declaredEmployment?.employer ?? 'Synthetic employer',
    jobTitle: 'Synthetic role',
    employmentTenure: 0,
    monthlyIncome: application.application.monthlyIncome,
    monthlyObligations: application.application.monthlyObligations,
    educationCredential: 'Synthetic credential',
    requestedAmount: application.application.requestedAmount,
    repaymentTenure: application.application.loanTenureMonths,
    bureauScore: application.application.bureauScore,
    purpose: 'Synthetic evaluation',
    sources: sourceMap(application),
  };
}

function toRecord(application: ApiApplication): ApplicationRecord {
  const score = application.latestScore;
  const status = score ? (score.fraudReview.status === 'clear' ? 'Reviewed' : 'Needs attention') : 'Draft';
  const review = score ? {
    score,
    fairness: null,
    evidence: score.evidence,
    alternativeAvailable: score.alternativeContribution !== 0,
    explanation: 'This API-owned assessment uses deterministic evidence and consented synthetic sources. It is not a lending decision.',
    timeline: application.behaviorUpdates.map((update) => ({ label: 'Behavior update', detail: update.eventType, time: update.observedAt })),
    sourceComparison: [],
  } : null;
  return {
    id: application.simulationId,
    synthetic: true,
    status,
    createdAt: score?.generatedAt ?? new Date().toISOString(),
    updatedAt: score?.generatedAt ?? new Date().toISOString(),
    draft: toDraft(application),
    review,
    apiApplication: application,
  };
}

function applicationInput(draft: ApplicationDraft, simulationId: string, applicantId = 'app-hero'): ApplicationInput {
  return {
    simulationId,
    applicantId,
    application: {
      bureauScore: draft.bureauScore,
      monthlyIncome: draft.monthlyIncome,
      monthlyObligations: draft.monthlyObligations,
      requestedAmount: draft.requestedAmount,
      loanTenureMonths: draft.repaymentTenure,
    },
    declaredEmployment: draft.employer ? { employer: draft.employer } : undefined,
  };
}

function sourceToApi(source: DataSourceKey): ApiProviderSource | null {
  if (source === 'accountAggregator') return 'account_aggregator';
  if (source === 'employmentDigiLocker') return 'digilocker_employment';
  if (source === 'educationDigiLocker') return 'digilocker_education';
  return null;
}

export function ApplicationsProvider({ children, getToken }: { children: ReactNode; getToken?: TokenGetter }) {
  const api = useMemo(() => createApiClient({ getToken: getToken ?? (async () => null) }), [getToken]);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(getToken));
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!getToken) return;
    setLoading(true);
    try {
      const response = await api.getApplications();
      setApplications(response.applications.map(toRecord));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Applications could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [getToken]);

  const saveDraft = async (draft: ApplicationDraft, id?: string) => {
    const simulationId = id ?? `sim-${crypto.randomUUID()}`;
    const response = await api.createApplication(applicationInput(draft, simulationId));
    const record = toRecord(response.application);
    setApplications((current) => [record, ...current.filter((item) => item.id !== record.id)]);
    return record;
  };

  const runReview = async (draft: ApplicationDraft, id?: string) => {
    const simulationId = id ?? `sim-${crypto.randomUUID()}`;
    const applicantId = 'app-hero';
    await api.createConsent({ simulationId, applicantId, purposes: ['application_baseline'], categories: ['application_baseline'], source: 'synthetic_fixture' });
    const saved = await saveDraft(draft, simulationId);
    const connectedSources = (Object.entries(draft.sources) as Array<[DataSourceKey, { state: string }]>).filter(([, source]) => source.state === 'Connected');
    for (const [source] of connectedSources) {
      const apiSource = sourceToApi(source);
      if (!apiSource) continue;
      const consent = await api.createConsent({ simulationId, applicantId, purposes: ['alternative_cashflow'], categories: [apiSource], source: 'synthetic_fixture' });
      await api.connectProvider(simulationId, apiSource, consent.receipt.consentId);
    }
    const score = await api.getScore({ simulationId, applicantId, mode: connectedSources.length > 0 ? 'consented_dynamic' : 'baseline_only' });
    const updated: ApiApplication = { ...(saved.apiApplication as ApiApplication), latestScore: score.result };
    const record = toRecord(updated);
    setApplications((current) => [record, ...current.filter((item) => item.id !== record.id)]);
    return record;
  };

  const loadExample = async () => runReview({
    applicantName: 'Synthetic Applicant A', address: 'Synthetic fixture address', employmentType: 'Salaried', employer: 'Synthetic employer', jobTitle: 'Synthetic role', employmentTenure: 48, monthlyIncome: 95000, monthlyObligations: 25000, educationCredential: 'Synthetic credential', requestedAmount: 120000, repaymentTenure: 12, bureauScore: 720, purpose: 'Synthetic evaluation', sources: { accountAggregator: { consent: true, state: 'Connected' }, employmentDigiLocker: { consent: false, state: 'Not connected' }, educationDigiLocker: { consent: false, state: 'Not connected' }, professional: { consent: false, state: 'Not connected' } },
  }, `example-${crypto.randomUUID()}`);

  const updateSource = async (id: string, source: DataSourceKey, consent: boolean) => {
    const current = applications.find((item) => item.id === id);
    if (!current?.apiApplication) throw new Error('Application not found.');
    const apiSource = sourceToApi(source);
    if (!apiSource || !consent) return current;
    const receipt = await api.createConsent({ simulationId: id, applicantId: current.apiApplication.applicantId, purposes: ['alternative_cashflow'], categories: [apiSource], source: 'synthetic_fixture' });
    await api.connectProvider(id, apiSource, receipt.receipt.consentId);
    const response = await api.getApplication(id);
    const record = toRecord(response.application);
    setApplications((items) => items.map((item) => item.id === id ? record : item));
    return record;
  };

  const value: ApplicationsContextValue = {
    applications,
    loading,
    error,
    saveDraft,
    runReview,
    loadExample,
    find: (id) => applications.find((item) => item.id === id) ?? null,
    updateSource,
    refresh,
  };
  return <ApplicationsContext.Provider value={value}>{children}</ApplicationsContext.Provider>;
}

export function useApplications() {
  const value = useContext(ApplicationsContext);
  if (!value) throw new Error('useApplications must be used within ApplicationsProvider.');
  return value;
}
