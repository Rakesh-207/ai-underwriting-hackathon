import type {
  ErrorEnvelope,
  HealthResponse,
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

  return {
    // Public health check — no token required.
    async getHealth(): Promise<HealthResponse> {
      const res = await fetch(`${getApiBaseUrl()}/api/health`);
      return (await res.json()) as HealthResponse;
    },

    // Generic protected request helper.
    authedFetch,
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

export { getApiBaseUrl as API_BASE_URL };
