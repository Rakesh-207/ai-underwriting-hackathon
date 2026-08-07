import { describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn(async () => ({ sub: 'journey-user' })) }));

import app from '../src/index.ts';
import type { Env } from '../src/env.ts';

const env: Env = { CLERK_SECRET_KEY: 'test-placeholder', CLERK_AUTHORIZED_PARTIES: 'http://localhost:5173' };
const auth = { authorization: 'Bearer journey-token' };

async function request(path: string, init: RequestInit = {}) {
  return app.fetch(new Request(`http://localhost${path}`, init), env);
}

async function read<T>(response: Response) {
  return await response.json() as T;
}

describe('deterministic synthetic browser journey contract', () => {
  it('covers landing health, auth boundary, consent, applicant, score, behavior, audit, and fairness', async () => {
    expect((await request('/api/health')).status).toBe(200);
    expect((await request('/api/score', { method: 'POST' })).status).toBe(401);

    const consent = await request('/api/consent', {
      method: 'POST', headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'sim-journey', applicantId: 'app-review', purposes: ['application_baseline', 'alternative_cashflow', 'behavior_updates'], categories: ['bureau', 'salary', 'cashflow'], source: 'synthetic_fixture' }),
    });
    expect(consent.status).toBe(201);
    const consentBody = await read<{ receipt: { consentId: string } }>(consent);

    const applicants = await request('/api/demo/applicants', { headers: auth });
    expect(applicants.status).toBe(200);
    expect((await read<{ applicants: Array<{ applicantId: string }> }>(applicants)).applicants.map((item) => item.applicantId)).toContain('app-review');

    const baseline = await request('/api/score', {
      method: 'POST', headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'sim-journey', applicantId: 'app-review', mode: 'baseline_only' }),
    });
    const baselineBody = await read<{ result: { dynamicScore: number } }>(baseline);
    const dynamic = await request('/api/score', {
      method: 'POST', headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'sim-journey', applicantId: 'app-review', mode: 'consented_dynamic' }),
    });
    const dynamicBody = await read<{ result: { dynamicScore: number } }>(dynamic);
    expect(dynamicBody.result.dynamicScore).toBeGreaterThan(baselineBody.result.dynamicScore);

    const behavior = await request('/api/behavior', {
      method: 'POST', headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'sim-journey', applicantId: 'app-review', consentId: consentBody.receipt.consentId, eventType: 'payment_observation', value: 0.99 }),
    });
    expect(behavior.status).toBe(200);
    const behaviorBody = await read<{ result: { dynamicScore: number } }>(behavior);
    expect(behaviorBody.result.dynamicScore).toBeGreaterThan(dynamicBody.result.dynamicScore);

    const fairness = await request('/api/fairness', {
      method: 'POST', headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'sim-journey' }),
    });
    expect(fairness.status).toBe(200);
    const audit = await request('/api/audit/sim-journey', { headers: auth });
    const events = (await read<{ events: Array<{ eventType: string }> }>(audit)).events.map((event) => event.eventType);
    expect(events).toEqual(expect.arrayContaining(['consent', 'score', 'behavior_update', 'fairness']));
  });
});
