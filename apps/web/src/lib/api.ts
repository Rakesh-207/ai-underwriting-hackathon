import type {
  ApplicantsResponse,
  AuditEvent,
  BehaviorUpdate,
  ConsentPurpose,
  ConsentResponse,
  FairnessReport,
  ErrorEnvelope,
  HealthResponse,
  ScoreResult,
} from '@underwriting/shared';

function getApiBaseUrl(): string {
  const url = import.meta.env.VITE_API_BASE_URL;
  if (!url) {
    throw new Error(
      'VITE_API_BASE_URL must be set. See .env.example.',
    );
  }
  return url;
}

// A token getter function. The Clerk session's getToken() satisfies this.
// auth contract 1.2: "the protected fetch boundary calls Clerk's getToken()
// and attaches the resolved session token to every cross-origin API request."
export type TokenGetter = () => Promise<string | null>;

export interface ApiClientOptions {
  getToken: TokenGetter;
}

export interface ConsentInput {
  simulationId: string;
  applicantId: string;
  purposes: ConsentPurpose[];
  categories: string[];
  source: 'synthetic_fixture' | 'consented_manual_entry';
}

export interface ScoreInput {
  simulationId: string;
  applicantId: string;
  mode: 'baseline_only' | 'consented_dynamic';
}

export interface BehaviorInput {
  simulationId: string;
  applicantId: string;
  consentId: string;
  eventType: BehaviorUpdate['eventType'];
  value: number;
}

export class ApiError extends Error {
  readonly status: number;
  readonly envelope: ErrorEnvelope | null;

  constructor(status: number, envelope: ErrorEnvelope | null, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.envelope = envelope;
  }
}

// Build an ApiClient bound to a Clerk token getter. All protected calls
// automatically attach `Authorization: Bearer <session-token>` (auth contract 1.5).
export function createApiClient(opts: ApiClientOptions) {
  async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const token = await opts.getToken();
    const headers = new Headers(init.headers);
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    if (init.body && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
    const res = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers,
    });
    // auth contract: 401 responses are surfaced to the caller for handling
    // (e.g. redirect to sign-in). We throw a typed ApiError.
    if (res.status === 401) {
      let envelope: ErrorEnvelope | null = null;
      try {
        envelope = (await res.json()) as ErrorEnvelope;
      } catch {
        envelope = null;
      }
      throw new ApiError(401, envelope, 'Authentication required.');
    }
    return res;
  }

  async function jsonRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await authedFetch(path, init);
    if (!res.ok) {
      throw new ApiError(res.status, null, `API request failed (${res.status}).`);
    }
    return (await res.json()) as T;
  }

  return {
    // Public health check — no token required.
    async getHealth(): Promise<HealthResponse> {
      const res = await fetch(`${getApiBaseUrl()}/api/health`);
      return (await res.json()) as HealthResponse;
    },

    async getApplicants(): Promise<ApplicantsResponse> {
      return jsonRequest<ApplicantsResponse>('/api/demo/applicants');
    },

    async createConsent(input: ConsentInput): Promise<ConsentResponse> {
      return jsonRequest<ConsentResponse>('/api/consent', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },

    async revokeConsent(consentId: string): Promise<ConsentResponse> {
      return jsonRequest<ConsentResponse>(`/api/consent/${consentId}/revoke`, { method: 'POST' });
    },

    async getScore(input: ScoreInput): Promise<{ result: ScoreResult }> {
      return jsonRequest<{ result: ScoreResult }>('/api/score', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },

    async applyBehavior(input: BehaviorInput): Promise<{ result: ScoreResult; update: BehaviorUpdate }> {
      return jsonRequest<{ result: ScoreResult; update: BehaviorUpdate }>('/api/behavior', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },

    async getFairness(input: { simulationId: string }): Promise<{ report: FairnessReport }> {
      return jsonRequest<{ report: FairnessReport }>('/api/fairness', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },

    async getAudit(simulationId: string): Promise<{ events: AuditEvent[] }> {
      return jsonRequest<{ events: AuditEvent[] }>(`/api/audit/${simulationId}`);
    },

    // Generic protected request helper.
    authedFetch,
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

export { getApiBaseUrl as API_BASE_URL };
