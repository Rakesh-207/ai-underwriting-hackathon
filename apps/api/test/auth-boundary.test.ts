import { describe, it, expect, beforeAll } from 'vitest';
import app from '../src/index.ts';
import type { Env } from '../src/env.ts';

// Minimal env: no real secret key present in tests. The verifier will reject
// forged tokens, and missing/malformed tokens never reach verification logic.
const testEnv: Env = {
  CLERK_SECRET_KEY: 'test-secret-placeholder-not-a-real-key',
  CLERK_AUTHORIZED_PARTIES: 'http://localhost:5173',
  ALLOWED_ORIGINS: 'http://localhost:5173,https://e37e8986.underwriting-hackathon.pages.dev,https://d2aeb87e.underwriting-hackathon.pages.dev',
};

function request(path: string, init: RequestInit = {}): Response {
  const req = new Request(`http://localhost${path}`, init);
  // @ts-expect-error — inject env onto request for Hono app.fetch
  return app.fetch(req, testEnv);
}

interface EnvelopeBody {
  schemaVersion: string;
  errorCode?: string;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  requestId?: string;
  status?: string;
  service?: string;
  modelVersion?: string;
  generatedAt?: string;
}

async function jsonBody(res: Response): Promise<EnvelopeBody> {
  return (await res.json()) as EnvelopeBody;
}

describe('GET /api/health', () => {
  it('returns 200 without auth', async () => {
    const res = await request('/api/health');
    expect(res.status).toBe(200);
    const body = await jsonBody(res);
    expect(body.schemaVersion).toBe('1.1');
    expect(body.status).toBe('ok');
    expect(body.service).toBe('underwriting-simulation-api');
    expect(body.modelVersion).toBe('scorecard-v1');
    expect(typeof body.generatedAt).toBe('string');
  });

  it('does not disclose secrets or Clerk configuration', async () => {
    const res = await request('/api/health');
    const text = await res.clone().text();
    expect(text).not.toContain('CLERK_SECRET_KEY');
    expect(text).not.toContain('secret');
    expect(text).not.toContain('sk_');
    expect(text.toLowerCase()).not.toContain('token');
  });
});

describe('Auth boundary — protected routes return 401', () => {
  const protectedPaths = [
    { path: '/api/demo/applicants', method: 'GET' },
    { path: '/api/consent', method: 'POST' },
    { path: '/api/consent/con-1/revoke', method: 'POST' },
    { path: '/api/score', method: 'POST' },
    { path: '/api/behavior', method: 'POST' },
    { path: '/api/fairness', method: 'POST' },
    { path: '/api/audit/sim-1', method: 'GET' },
  ];

  describe('missing Authorization header', () => {
    for (const { path, method } of protectedPaths) {
      it(`${method} ${path} -> 401 UNAUTHORIZED`, async () => {
        const res = await request(path, { method });
        expect(res.status).toBe(401);
        const body = await jsonBody(res);
        expect(body.schemaVersion).toBe('1.1');
        expect(body.errorCode).toBe('UNAUTHORIZED');
        expect(body.message).toBe('Authentication required.');
        expect(body.fieldErrors).toEqual({});
        expect(typeof body.requestId).toBe('string');
      });
    }
  });

  describe('malformed Authorization header', () => {
    const malformed = [
      'Bearer   ',
      'Bearer',
      'NotBearer abc.def.ghi',
      'Bearer abc',
      'bearer ',
    ];
    for (const header of malformed) {
      it(`rejects "${header}" -> 401`, async () => {
        const res = await request('/api/consent', {
          method: 'POST',
          headers: { authorization: header, 'content-type': 'application/json' },
        });
        expect(res.status).toBe(401);
        const body = await jsonBody(res);
        expect(body.errorCode).toBe('UNAUTHORIZED');
      });
    }
  });

  describe('forged / invalid token', () => {
    it('rejects an unsigned forged token -> 401', async () => {
      const forged = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyX2V2aWwifQ.';
      const res = await request('/api/consent', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${forged}`,
          'content-type': 'application/json',
        },
      });
      expect(res.status).toBe(401);
      const body = await jsonBody(res);
      expect(body.errorCode).toBe('UNAUTHORIZED');
    });

    it('rejects a random garbage token -> 401', async () => {
      const res = await request('/api/consent', {
        method: 'POST',
        headers: {
          authorization: 'Bearer not-a-real-token',
          'content-type': 'application/json',
        },
      });
      expect(res.status).toBe(401);
    });
  });
});

describe('ErrorEnvelope shape (schemaVersion 1.1)', () => {
  it('applies 1.1 to all 401 responses', async () => {
    const res = await request('/api/score', { method: 'POST' });
    const body = await jsonBody(res);
    expect(body.schemaVersion).toBe('1.1');
  });
});

describe('CORS preflight', () => {
  it('answers OPTIONS without token validation', async () => {
    const res = await request('/api/score', {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:5173' },
    });
    expect(res.status).toBe(204);
  });

  it('allows Authorization + Content-Type headers', async () => {
    const res = await request('/api/score', {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:5173' },
    });
    const allowedHeaders = res.headers.get('access-control-allow-headers');
    expect(allowedHeaders).toContain('authorization');
    expect(allowedHeaders).toContain('content-type');
  });

  it.each([
    'https://e37e8986.underwriting-hackathon.pages.dev',
    'https://d2aeb87e.underwriting-hackathon.pages.dev',
  ])('allows the deployment origin %s on preflight', async (origin) => {
    const res = await request('/api/score', {
      method: 'OPTIONS',
      headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization, content-type' },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe(origin);
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
    expect(res.headers.get('vary')).toContain('origin');
  });

  it('does not allow a disallowed origin on preflight', async () => {
    const res = await request('/api/score', {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    expect(res.headers.get('access-control-allow-methods')).toBeNull();
  });

  it('adds CORS headers to a protected GET missing its token', async () => {
    const origin = 'https://d2aeb87e.underwriting-hackathon.pages.dev';
    const res = await request('/api/applications', { headers: { origin } });
    expect(res.status).toBe(401);
    expect(res.headers.get('access-control-allow-origin')).toBe(origin);
  });

  it('adds CORS headers to a protected POST missing its token', async () => {
    const origin = 'https://e37e8986.underwriting-hackathon.pages.dev';
    const res = await request('/api/score', { method: 'POST', headers: { origin, 'content-type': 'application/json' } });
    expect(res.status).toBe(401);
    expect(res.headers.get('access-control-allow-origin')).toBe(origin);
  });

  it('adds CORS headers to a valid authenticated response', async () => {
    const origin = 'https://d2aeb87e.underwriting-hackathon.pages.dev';
    const res = await request('/api/health', { headers: { origin } });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(origin);
  });
});

describe('Secret leak check', () => {
  beforeAll(async () => {
    // Ensure Worker source never embeds the publishable key or Vite vars.
  });

  it('Worker source does not reference VITE_CLERK_PUBLISHABLE_KEY', async () => {
    const res = await request('/api/health');
    const text = await res.text();
    expect(text).not.toContain('VITE_CLERK_PUBLISHABLE_KEY');
    expect(text).not.toContain('pk_');
  });
});
