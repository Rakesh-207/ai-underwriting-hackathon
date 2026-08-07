import { describe, it, expect } from 'vitest';
import { createApiClient, ApiError } from '../lib/api.ts';

// Stub the Vite env import that api.ts reads at module load.
// (In the test environment VITE_API_BASE_URL is injected via vitest define.)
const TOKEN = 'test-session-token';

describe('createApiClient', () => {
  it('attaches Authorization: Bearer from getToken()', async () => {
    let capturedHeaders: Headers | null = null;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response('{"status":"ok"}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof globalThis.fetch;

    try {
      const client = createApiClient({ getToken: async () => TOKEN });
      await client.authedFetch('/api/consent', { method: 'POST' });
      expect(capturedHeaders).not.toBeNull();
      expect(capturedHeaders!.get('authorization')).toBe(`Bearer ${TOKEN}`);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('throws ApiError on 401', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
          schemaVersion: '1.1',
          errorCode: 'UNAUTHORIZED',
          message: 'Authentication required.',
          fieldErrors: {},
          requestId: 'req-test',
        }),
        { status: 401, headers: { 'content-type': 'application/json' } },
      );
    }) as typeof globalThis.fetch;

    try {
      const client = createApiClient({ getToken: async () => TOKEN });
      await expect(
        client.authedFetch('/api/score', { method: 'POST' }),
      ).rejects.toBeInstanceOf(ApiError);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('health check requires no token', async () => {
    let capturedAuth: string | null = null;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedAuth = new Headers(init?.headers).get('authorization');
      return new Response(
        JSON.stringify({
          schemaVersion: '1.1',
          status: 'ok',
          service: 'underwriting-simulation-api',
          repository: 'memory',
          modelVersion: 'scorecard-v1',
          generatedAt: '2026-08-07T00:00:00.000Z',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }) as typeof globalThis.fetch;

    try {
      const client = createApiClient({ getToken: async () => TOKEN });
      const health = await client.getHealth();
      expect(health.status).toBe('ok');
      expect(health.schemaVersion).toBe('1.1');
      // Health does not send an auth header.
      expect(capturedAuth).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
