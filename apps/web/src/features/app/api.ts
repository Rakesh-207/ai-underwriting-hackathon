import type { ApiClient } from '../../lib/api.ts';
import type {
  ApplicantProfile,
  ApplicantsResponse,
  AuditEvent,
  ConsentReceipt,
  FairnessReport,
  ScoreResult,
} from '@underwriting/shared';

export interface AppApi {
  getApplicants(): Promise<ApplicantsResponse>;
  getSimulation(simulationId: string): Promise<{
    applicant?: ApplicantProfile;
    consent?: ConsentReceipt;
    score?: ScoreResult;
    fairness?: FairnessReport;
    audit?: AuditEvent[];
  }>;
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}).`);
  }
  return (await response.json()) as T;
}

export function createAppApi(client: ApiClient): AppApi {
  return {
    async getApplicants() {
      return json<ApplicantsResponse>(
        await client.authedFetch('/api/demo/applicants'),
      );
    },
    async getSimulation(simulationId) {
      // Each resource remains an API concern. The browser never derives a score.
      const response = await client.authedFetch(
        `/api/audit/${encodeURIComponent(simulationId)}`,
      );
      const audit = await json<AuditEvent[]>(response);
      return { audit };
    },
  };
}
