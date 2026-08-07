import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(async () => ({ sub: 'user-1' })),
}));

import app from '../src/index.ts';
import type { Env } from '../src/env.ts';

const env: Env = { CLERK_SECRET_KEY: 'test-placeholder', CLERK_AUTHORIZED_PARTIES: 'https://app.example.com,http://localhost:5173' };
const auth = { authorization: 'Bearer valid-test-token' };

async function request(path: string, init: RequestInit = {}) {
  return app.fetch(new Request(`http://localhost${path}`, init), env);
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

describe('API simulation routes', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns synthetic applicants only after consent exists', async () => {
    const blocked = await request('/api/demo/applicants', { headers: auth });
    expect(blocked.status).toBe(403);

    const consent = await request('/api/consent', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({
        simulationId: 'sim-demo',
        applicantId: 'app-review',
        purposes: ['application_baseline', 'alternative_cashflow'],
        categories: ['bureau', 'salary', 'cashflow'],
        source: 'synthetic_fixture',
      }),
    });
    expect(consent.status).toBe(201);

    const applicants = await request('/api/demo/applicants', { headers: auth });
    expect(applicants.status).toBe(200);
    const body = await json<{ applicants: Array<{ applicantId: string }> }>(applicants);
    expect(body.applicants.some((item) => item.applicantId === 'app-review')).toBe(true);
  });

  it('creates and revokes an owned consent receipt', async () => {
    const created = await request('/api/consent', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({
        simulationId: 'sim-revoke',
        applicantId: 'app-review',
        purposes: ['alternative_cashflow'],
        categories: ['cashflow'],
        source: 'synthetic_fixture',
      }),
    });
    expect(created.status).toBe(201);
    const receipt = await json<{ receipt: { consentId: string; status: string } }>(created);
    expect(receipt.receipt.status).toBe('granted');

    const revoked = await request(`/api/consent/${receipt.receipt.consentId}/revoke`, {
      method: 'POST',
      headers: auth,
    });
    expect(revoked.status).toBe(200);
    const revokedBody = await json<{ receipt: { status: string } }>(revoked);
    expect(revokedBody.receipt.status).toBe('revoked');
  });

  it('returns baseline and dynamic scores, then applies a behavior delta', async () => {
    const create = await request('/api/consent', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({
        simulationId: 'sim-score',
        applicantId: 'app-review',
        purposes: ['application_baseline', 'alternative_cashflow', 'behavior_updates'],
        categories: ['bureau', 'salary', 'cashflow'],
        source: 'synthetic_fixture',
      }),
    });
    const receipt = await json<{ receipt: { consentId: string } }>(create);
    const baseline = await request('/api/score', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'sim-score', applicantId: 'app-review', mode: 'baseline_only' }),
    });
    expect(baseline.status).toBe(200);
    const baselineBody = await json<{ result: { dynamicScore: number } }>(baseline);

    const dynamic = await request('/api/score', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'sim-score', applicantId: 'app-review', mode: 'consented_dynamic' }),
    });
    expect(dynamic.status).toBe(200);
    const dynamicBody = await json<{ result: { dynamicScore: number } }>(dynamic);
    expect(dynamicBody.result.dynamicScore).not.toBe(baselineBody.result.dynamicScore);

    const behavior = await request('/api/behavior', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({
        simulationId: 'sim-score',
        applicantId: 'app-review',
        consentId: receipt.receipt.consentId,
        eventType: 'payment_observation',
        value: 0.99,
      }),
    });
    expect(behavior.status).toBe(200);
    const behaviorBody = await json<{ result: { dynamicScore: number } }>(behavior);
    expect(behaviorBody.result.dynamicScore).toBeGreaterThan(dynamicBody.result.dynamicScore);
  });

  it('evaluates fairness and returns the owned audit trail', async () => {
    const fairness = await request('/api/fairness', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'sim-fair' }),
    });
    expect(fairness.status).toBe(200);
    const fairnessBody = await json<{ report: { cohorts: unknown[] } }>(fairness);
    expect(fairnessBody.report.cohorts.length).toBeGreaterThan(0);

    const audit = await request('/api/audit/sim-fair', { headers: auth });
    expect(audit.status).toBe(200);
    const auditBody = await json<{ events: Array<{ eventType: string }> }>(audit);
    expect(auditBody.events.some((event) => event.eventType === 'fairness')).toBe(true);
  });

  it('denies access when a different principal owns the receipt', async () => {
    const created = await request('/api/consent', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({
        simulationId: 'sim-owner',
        applicantId: 'app-hero',
        purposes: ['application_baseline'],
        categories: ['bureau'],
        source: 'synthetic_fixture',
      }),
    });
    const receipt = await json<{ receipt: { consentId: string } }>(created);
    const { verifyToken } = await import('@clerk/backend');
    vi.mocked(verifyToken).mockResolvedValueOnce({ sub: 'user-2' } as never);
    const denied = await request(`/api/consent/${receipt.receipt.consentId}/revoke`, {
      method: 'POST',
      headers: auth,
    });
    expect(denied.status).toBe(403);
  });
});
