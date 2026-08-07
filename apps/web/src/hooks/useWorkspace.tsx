import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@clerk/react';
import type {
  ApplicantProfile,
  AuditEvent,
  ConsentPurpose,
  ConsentReceipt,
  FairnessReport,
  ScoreResult,
} from '@underwriting/shared';
import { createApiClient } from '../lib/api.ts';

export const simulationId = 'sim-demo';
const applicantId = 'app-hero';

type SimulationContextValue = {
  simulationId: string;
  applicantId: string;
  receipts: ConsentReceipt[];
  applicant: ApplicantProfile | null;
  baselineScore: ScoreResult | null;
  dynamicScore: ScoreResult | null;
  behaviorScore: ScoreResult | null;
  fairness: FairnessReport | null;
  auditEvents: AuditEvent[];
  loading: boolean;
  error: string | null;
  grantConsent: (purpose: ConsentPurpose) => Promise<void>;
  revokeConsent: (consentId: string) => Promise<void>;
  loadApplicants: () => Promise<void>;
  loadScore: (mode: 'baseline_only' | 'consented_dynamic') => Promise<void>;
  applyBehavior: (value: number) => Promise<void>;
  loadFairness: () => Promise<void>;
  loadAudit: () => Promise<void>;
};

const SimulationContext = createContext<SimulationContextValue | null>(null);

export function SimulationProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  const api = useMemo(() => createApiClient({ getToken }), [getToken]);
  const [receipts, setReceipts] = useState<ConsentReceipt[]>([]);
  const [applicant, setApplicant] = useState<ApplicantProfile | null>(null);
  const [baselineScore, setBaselineScore] = useState<ScoreResult | null>(null);
  const [dynamicScore, setDynamicScore] = useState<ScoreResult | null>(null);
  const [behaviorScore, setBehaviorScore] = useState<ScoreResult | null>(null);
  const [fairness, setFairness] = useState<FairnessReport | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run<T>(operation: () => Promise<T>, onSuccess: (value: T) => void = () => undefined) {
    setLoading(true);
    setError(null);
    try {
      onSuccess(await operation());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The API request failed.');
    } finally {
      setLoading(false);
    }
  }

  const value: SimulationContextValue = {
    simulationId,
    applicantId,
    receipts,
    applicant,
    baselineScore,
    dynamicScore,
    behaviorScore,
    fairness,
    auditEvents,
    loading,
    error,
    grantConsent: async (purpose) => {
      await run(
        () => api.createConsent({ simulationId, applicantId, purposes: [purpose], categories: [purpose], source: 'synthetic_fixture' }),
        (response) => setReceipts((current) => [...current.filter((item) => !item.purposes.includes(purpose)), response.receipt]),
      );
    },
    revokeConsent: async (consentId) => {
      await run(() => api.revokeConsent(consentId), (response) => setReceipts((current) => current.map((item) => item.consentId === consentId ? response.receipt : item)));
    },
    loadApplicants: async () => {
      await run(api.getApplicants, (response) => {
        const selected = response.applicants.find((item) => item.applicantId === applicantId);
        if (selected) setApplicant(selected as unknown as ApplicantProfile);
      });
    },
    loadScore: async (mode) => {
      await run(() => api.getScore({ simulationId, applicantId, mode }), (response) => mode === 'baseline_only' ? setBaselineScore(response.result) : setDynamicScore(response.result));
    },
    applyBehavior: async (value) => {
      const consent = receipts.find((item) => item.status === 'granted' && item.purposes.includes('behavior_updates'));
      if (!consent) {
        setError('Behavior-update consent is required.');
        return;
      }
      await run(() => api.applyBehavior({ simulationId, applicantId, consentId: consent.consentId, eventType: 'income_observation', value }), (response) => {
        setBehaviorScore(response.result);
        setDynamicScore(response.result);
      });
    },
    loadFairness: async () => {
      await run(() => api.getFairness({ simulationId }), (response) => setFairness(response.report));
    },
    loadAudit: async () => {
      await run(() => api.getAudit(simulationId), (response) => setAuditEvents(response.events));
    },
  };

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

export function useSimulation() {
  const context = useContext(SimulationContext);
  if (!context) throw new Error('useSimulation must be used within SimulationProvider.');
  return context;
}

export function useConsentState() {
  const context = useSimulation();
  return { receipts: context.receipts, toggle: async (purpose: ConsentPurpose) => {
    const receipt = context.receipts.find((item) => item.purposes.includes(purpose));
    if (receipt?.status === 'granted') await context.revokeConsent(receipt.consentId);
    else await context.grantConsent(purpose);
  } };
}

export function hasConsent(purpose: ConsentPurpose) {
  return useSimulation().receipts.some((receipt) => receipt.purposes.includes(purpose) && receipt.status === 'granted');
}
