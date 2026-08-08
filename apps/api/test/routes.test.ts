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

  it('requires application_baseline consent before baseline scoring', async () => {
    const create = await request('/api/consent', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({
        simulationId: 'sim-purpose-only',
        applicantId: 'app-review',
        purposes: ['alternative_cashflow'],
        categories: ['cashflow'],
        source: 'synthetic_fixture',
      }),
    });
    expect(create.status).toBe(201);
    const score = await request('/api/score', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'sim-purpose-only', applicantId: 'app-review', mode: 'baseline_only' }),
    });
    expect(score.status).toBe(403);
    expect((await json<{ errorCode: string }>(score)).errorCode).toBe('CONSENT_REQUIRED');
  });

  it('denies mismatched applicant and consent resources', async () => {
    const create = await request('/api/consent', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({
        simulationId: 'sim-binding',
        applicantId: 'app-review',
        purposes: ['application_baseline', 'behavior_updates'],
        categories: ['bureau', 'salary'],
        source: 'synthetic_fixture',
      }),
    });
    const receipt = await json<{ receipt: { consentId: string } }>(create);
    const score = await request('/api/score', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'sim-binding', applicantId: 'app-hero', mode: 'baseline_only' }),
    });
    expect(score.status).toBe(403);

    const behavior = await request('/api/behavior', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({
        simulationId: 'sim-binding', applicantId: 'app-hero', consentId: receipt.receipt.consentId,
        eventType: 'payment_observation', value: 0.99,
      }),
    });
    expect(behavior.status).toBe(403);
  });

  it('returns repeatable receipt hashes and verifies persisted receipts', async () => {
    const payload = {
      simulationId: 'sim-hash', applicantId: 'app-hero', purposes: ['application_baseline'],
      categories: ['bureau'], source: 'synthetic_fixture',
    };
    const first = await request('/api/consent', {
      method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify(payload),
    });
    const firstBody = await json<{ receipt: { receiptHash: string; consentId: string; grantedAt: string } }>(first);
    const second = await request('/api/consent', {
      method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ ...payload, simulationId: 'sim-hash-2' }),
    });
    const secondBody = await json<{ receipt: { receiptHash: string } }>(second);
    expect(firstBody.receipt.receiptHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(secondBody.receipt.receiptHash).not.toBe(firstBody.receipt.receiptHash);
    const changed = await request('/api/consent', {
      method: 'POST', headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ ...payload, simulationId: 'sim-hash-3', categories: ['bureau', 'salary'] }),
    });
    const changedBody = await json<{ receipt: { receiptHash: string } }>(changed);
    expect(changedBody.receipt.receiptHash).not.toBe(firstBody.receipt.receiptHash);
    expect(firstBody.receipt.consentId).toBeTruthy();
    expect(firstBody.receipt.grantedAt).toBeTruthy();
  });

  it('returns a scorecard-derived behavior score with distinct bound audit events', async () => {
    const create = await request('/api/consent', {
      method: 'POST', headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'sim-behavior-contract', applicantId: 'app-review', purposes: ['application_baseline', 'alternative_cashflow', 'behavior_updates'], categories: ['bureau', 'cashflow'], source: 'synthetic_fixture' }),
    });
    const receipt = await json<{ receipt: { consentId: string } }>(create);
    const initial = await request('/api/score', {
      method: 'POST', headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'sim-behavior-contract', applicantId: 'app-review', mode: 'consented_dynamic' }),
    });
    const initialBody = await json<{ result: { scoreId: string; dynamicScore: number; evidence: unknown[]; auditEventId: string } }>(initial);
    const behavior = await request('/api/behavior', {
      method: 'POST', headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'sim-behavior-contract', applicantId: 'app-review', consentId: receipt.receipt.consentId, eventType: 'payment_observation', value: 0.99 }),
    });
    const behaviorBody = await json<{ result: { scoreId: string; dynamicScore: number; evidence: unknown[]; auditEventId: string }; behaviorAuditEventId: string }>(behavior);
    expect(behaviorBody.result.scoreId).not.toBe(initialBody.result.scoreId);
    expect(behaviorBody.result.dynamicScore).toBeGreaterThan(initialBody.result.dynamicScore);
    expect(behaviorBody.result.evidence.length).toBeGreaterThan(initialBody.result.evidence.length);
    expect(behaviorBody.result.auditEventId).not.toBe(behaviorBody.behaviorAuditEventId);

    const audit = await request('/api/audit/sim-behavior-contract', { headers: auth });
    const auditBody = await json<{ events: Array<{ eventType: string; eventId: string; simulationId: string; applicantId: string; clerkUserId: string }> }>(audit);
    const scoreEvent = auditBody.events.find((event) => event.eventId === behaviorBody.result.auditEventId);
    const behaviorEvent = auditBody.events.find((event) => event.eventId === behaviorBody.behaviorAuditEventId);
    expect(scoreEvent?.eventType).toBe('score');
    expect(behaviorEvent?.eventType).toBe('behavior_update');
    expect(scoreEvent?.simulationId).toBe('sim-behavior-contract');
    expect(scoreEvent?.applicantId).toBe('app-review');
    expect(behaviorEvent?.simulationId).toBe('sim-behavior-contract');
    expect(behaviorEvent?.applicantId).toBe('app-review');
    expect(scoreEvent?.clerkUserId).toBe('user-1');
    expect(behaviorEvent?.clerkUserId).toBe('user-1');
  });

  it('evaluates fairness and returns the owned audit trail', async () => {
    const consent = await request('/api/consent', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'sim-fair', applicantId: 'app-hero', purposes: ['application_baseline'], categories: ['application_baseline'], source: 'synthetic_fixture' }),
    });
    expect(consent.status).toBe(201);
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

  it('denies cross-user access to an owned simulation', async () => {
    const created = await request('/api/consent', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'sim-cross-user', applicantId: 'app-hero', purposes: ['application_baseline'], categories: ['bureau'], source: 'synthetic_fixture' }),
    });
    expect(created.status).toBe(201);
    const { verifyToken } = await import('@clerk/backend');
    vi.mocked(verifyToken).mockResolvedValueOnce({ sub: 'user-2' } as never);
    const denied = await request('/api/score', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'sim-cross-user', applicantId: 'app-hero', mode: 'baseline_only' }),
    });
    expect(denied.status).toBe(403);
  });

  it('returns a deterministic grounded explanation when the VPS is unavailable', async () => {
    const created = await request('/api/applications', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'sim-explanation', applicantId: 'app-hero' }),
    });
    expect(created.status).toBe(201);
    const consent = await request('/api/consent', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'sim-explanation', applicantId: 'app-hero', purposes: ['application_baseline'], categories: ['application_baseline'], source: 'synthetic_fixture' }),
    });
    expect(consent.status).toBe(201);
    const score = await request('/api/score', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'sim-explanation', applicantId: 'app-hero', mode: 'baseline_only' }),
    });
    expect(score.status).toBe(200);

    const explanation = await request('/api/explanation', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'sim-explanation', question: 'Why did the score change?' }),
    });
    expect(explanation.status).toBe(200);
    const explanationBody = await json<{ explanation: { trace: { fallback: boolean }; reasons: Array<{ evidenceId: string }> }; modelStatus: string; streaming: boolean; citationIds: string[] }>(explanation);
    expect(explanationBody.explanation.trace.fallback).toBe(true);
    expect(explanationBody.modelStatus).toBe('model-unavailable-fallback');
    expect(explanationBody.streaming).toBe(false);
    expect(explanationBody.explanation.reasons.length).toBeGreaterThan(0);
    expect(explanationBody.citationIds.length).toBeGreaterThan(0);
  });

  it('rejects applicant data in agent chat before any model request', async () => {
    const created = await request('/api/applications', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'sim-agent-sanitize', applicantId: 'app-hero' }),
    });
    expect(created.status).toBe(201);
    const consent = await request('/api/consent', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'sim-agent-sanitize', applicantId: 'app-hero', purposes: ['application_baseline'], categories: ['application_baseline'], source: 'synthetic_fixture' }),
    });
    expect(consent.status).toBe(201);
    const score = await request('/api/score', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'sim-agent-sanitize', applicantId: 'app-hero', mode: 'baseline_only' }),
    });
    expect(score.status).toBe(200);
    const response = await request('/api/agent-chat', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'sim-agent-sanitize', prompt: 'Tell me the applicant email and account number.' }),
    });
    expect(response.status).toBe(400);
    expect((await json<{ errorCode: string }>(response)).errorCode).toBe('VALIDATION_ERROR');
  });

  it('uses the completed fairness evaluation package for diagnostics', async () => {
    const consent = await request('/api/consent', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'sim-fair-package', applicantId: 'app-hero', purposes: ['application_baseline'], categories: ['application_baseline'], source: 'synthetic_fixture' }),
    });
    expect(consent.status).toBe(201);
    const response = await request('/api/fairness', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'sim-fair-package' }),
    });
    expect(response.status).toBe(200);
    const body = await json<{ diagnostic: { status: string; groupMetrics: unknown[]; checks: unknown[] } }>(response);
    expect(body.diagnostic.status).toBe('warn');
    expect(body.diagnostic.groupMetrics.length).toBe(3);
    expect(body.diagnostic.checks.length).toBe(4);
  });
});
