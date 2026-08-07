import { useAuth } from '@clerk/react';
import { useEffect, useState } from 'react';
import { createApiClient } from '../../lib/api.ts';
import type { ConsentReceipt } from '@underwriting/shared';
import { createAppApi } from './api.ts';
import type { SimulationData } from './types.ts';

const SIMULATION_ID = 'sim-synthetic-001';
const EMPTY: SimulationData = {
  simulationId: SIMULATION_ID,
  summary: {
    applicantId: 'Not available',
    reliabilityScore: null,
    riskBand: null,
    consentState: 'missing',
    lastUpdated: null,
  },
  applicants: [],
  applicant: null,
  consent: null,
  score: null,
  fairness: null,
  audit: [],
  loading: true,
  error: null,
};

export function useSimulation(): SimulationData {
  const { getToken } = useAuth();
  const [data, setData] = useState<SimulationData>(EMPTY);

  useEffect(() => {
    let active = true;
    const api = createAppApi(createApiClient({ getToken }));
    void api
      .getApplicants()
      .then((result) => {
        if (!active) return;
        const first = result.applicants[0];
        setData((current) => ({
          ...current,
          applicants: result.applicants,
          summary: {
            ...current.summary,
            applicantId: first?.applicantId ?? 'Not available',
            lastUpdated: result.generatedAt,
          },
          loading: false,
        }));
      })
      .catch((error: unknown) => {
        if (!active) return;
        setData((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : 'Data unavailable.',
        }));
      });
    return () => {
      active = false;
    };
  }, [getToken]);

  return data;
}

export function hasUsableConsent(consent: ConsentReceipt | null): boolean {
  return consent?.status === 'granted';
}
