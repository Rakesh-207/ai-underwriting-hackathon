import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConsentReceipt } from '@underwriting/shared';

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(async (token: string) => ({ sub: token === 'user-2-token' ? 'user-2' : 'user-1' })),
}));

import app from '../src/index.ts';
import type { Env } from '../src/env.ts';
import { D1SimulationRepository, repository } from '../src/repository.ts';
import { receiptHash, verifyReceiptHash } from '../src/receipt-hash.ts';

const env: Env = {
  CLERK_SECRET_KEY: 'test-placeholder',
  CLERK_AUTHORIZED_PARTIES: 'http://localhost:5173',
};

function auth(user = 'user-1') {
  return { authorization: `Bearer ${user === 'user-2' ? 'user-2-token' : 'valid-token'}` };
}

async function request(path: string, init: RequestInit = {}) {
  return app.fetch(new Request(`http://localhost${path}`, init), env);
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function grant(simulationId: string, purposes = ['application_baseline', 'alternative_cashflow', 'behavior_updates']) {
  const response = await request('/api/consent', {
    method: 'POST',
    headers: { ...auth(), 'content-type': 'application/json' },
    body: JSON.stringify({ simulationId, applicantId: 'app-review', purposes, categories: ['bureau', 'cashflow'], source: 'synthetic_fixture' }),
  });
  return json<{ receipt: ConsentReceipt }>(response);
}

describe('API and storage vertical slice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates and retrieves an owned application without accepting a body user id', async () => {
    await grant('application-owned', ['application_baseline']);
    const created = await request('/api/applications', {
      method: 'POST',
      headers: { ...auth(), 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'application-owned', applicantId: 'app-review', clerkUserId: 'user-2' }),
    });
    expect(created.status).toBe(201);
    const body = await json<{ application: { clerkUserId: string } }>(created);
    expect(body.application.clerkUserId).toBe('user-1');

    const retrieved = await request('/api/applications/application-owned', { headers: auth() });
    expect(retrieved.status).toBe(200);
    expect((await json<{ application: { simulationId: string } }>(retrieved)).application.simulationId).toBe('application-owned');

    const crossUser = await request('/api/applications/application-owned', { headers: auth('user-2') });
    expect(crossUser.status).toBe(403);
  });

  it('requires baseline consent before persisting application data', async () => {
    const response = await request('/api/applications', {
      method: 'POST',
      headers: { ...auth(), 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'application-without-consent', applicantId: 'app-review', application: { bureauScore: 700 } }),
    });
    expect(response.status).toBe(403);
  });

  it('lists consent receipts and exposes provider status only after exact consent', async () => {
    const first = await grant('provider-status', ['application_baseline']);
    const listed = await request('/api/consent?simulationId=provider-status', { headers: auth() });
    expect(listed.status).toBe(200);
    expect((await json<{ receipts: ConsentReceipt[] }>(listed)).receipts[0].receiptHash).toBe(first.receipt.receiptHash);

    const blocked = await request('/api/providers/account_aggregator/connect', {
      method: 'POST',
      headers: { ...auth(), 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'provider-status', consentId: first.receipt.consentId, persona: 'stable_salaried' }),
    });
    expect(blocked.status).toBe(403);

    const status = await request('/api/providers?simulationId=provider-status', { headers: auth() });
    expect(status.status).toBe(200);
    expect((await json<{ providers: Array<{ source: string; connected: boolean }> }>(status)).providers).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'account_aggregator', connected: false }),
      expect.objectContaining({ source: 'digilocker_employment', connected: false }),
    ]));
  });

  it('preserves provider provenance after consented connection', async () => {
    const consent = await grant('provider-connected', ['application_baseline', 'alternative_cashflow']);
    const connected = await request('/api/providers/account_aggregator/connect', {
      method: 'POST',
      headers: { ...auth(), 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'provider-connected', consentId: consent.receipt.consentId, persona: 'stable_salaried' }),
    });
    expect(connected.status).toBe(200);
    const body = await json<{ provenance: { source: string; reference: string }; consentReference: string }>(connected);
    expect(body.provenance.source).toBe('account_aggregator');
    expect(body.provenance.reference).toContain('aa:');
    expect(body.consentReference).toBe(consent.receipt.consentId);
  });

  it('rejects tampered persisted receipts before score and behavior operations', async () => {
    const consent = await grant('tampered-receipt');
    const tampered = { ...consent.receipt, categories: ['tampered'] };
    repository.saveConsent(tampered);
    expect(await verifyReceiptHash(tampered)).toBe(false);
    expect(await receiptHash(consent.receipt)).toMatch(/^sha256:[a-f0-9]{64}$/);
    const score = await request('/api/score', {
      method: 'POST',
      headers: { ...auth(), 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'tampered-receipt', applicantId: 'app-review', mode: 'baseline_only' }),
    });
    expect(score.status).toBe(409);
  });

  it('allows optional alternative consent to be declined without changing the baseline score', async () => {
    await grant('optional-consent', ['application_baseline']);
    const score = await request('/api/score', {
      method: 'POST',
      headers: { ...auth(), 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'optional-consent', applicantId: 'app-review', mode: 'consented_dynamic' }),
    });
    expect(score.status).toBe(200);
    const body = await json<{ result: { baselineScore: number; dynamicScore: number } }>(score);
    expect(body.result.dynamicScore).toBe(body.result.baselineScore);
  });

  it('returns engine-derived score evidence and recalculates through the engine for behavior', async () => {
    const consent = await grant('engine-score');
    const baseline = await request('/api/score', {
      method: 'POST',
      headers: { ...auth(), 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'engine-score', applicantId: 'app-review', mode: 'baseline_only' }),
    });
    expect(baseline.status).toBe(200);
    const baselineBody = await json<{ result: { baselineScore: number; evidence: Array<{ provenanceRef?: string; provenance?: string }> } }>(baseline);
    expect(baselineBody.result.evidence.length).toBeGreaterThan(0);
    expect(baselineBody.result.evidence.some((item) => item.provenance || item.provenanceRef)).toBe(true);

    const dynamic = await request('/api/score', {
      method: 'POST',
      headers: { ...auth(), 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'engine-score', applicantId: 'app-review', mode: 'consented_dynamic' }),
    });
    expect(dynamic.status).toBe(200);
    const dynamicBody = await json<{ result: { scoreId: string; dynamicScore: number } }>(dynamic);

    const behavior = await request('/api/behavior', {
      method: 'POST',
      headers: { ...auth(), 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'engine-score', applicantId: 'app-review', consentId: consent.receipt.consentId, eventType: 'payment_observation', value: 0.99 }),
    });
    expect(behavior.status).toBe(200);
    const behaviorBody = await json<{ result: { scoreId: string; evidence: unknown[] } }>(behavior);
    expect(behaviorBody.result.scoreId).not.toBe(dynamicBody.result.scoreId);
    expect(behaviorBody.result.evidence.length).toBeGreaterThan(0);
  });

  it('creates owned audit events and never emits outcome language', async () => {
    await grant('audit-language');
    const response = await request('/api/score', {
      method: 'POST',
      headers: { ...auth(), 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'audit-language', applicantId: 'app-review', mode: 'baseline_only' }),
    });
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toMatch(/approval|rejection|eligible|lending outcome/i);
    const audit = await request('/api/audit/audit-language', { headers: auth() });
    expect((await json<{ events: Array<{ eventType: string; clerkUserId: string }> }>(audit)).events).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventType: 'consent', clerkUserId: 'user-1' }),
      expect.objectContaining({ eventType: 'score', clerkUserId: 'user-1' }),
    ]));
  });

  it('supports D1 repository persistence when a binding is supplied', async () => {
    const calls: string[] = [];
    const db = {
      prepare(query: string) {
        calls.push(query);
        return { bind: () => ({ run: async () => ({ success: true }), first: async () => null, all: async () => ({ results: [] }) }) };
      },
    } as unknown as D1Database;
    const repository = new D1SimulationRepository(db);
    await repository.ensureSimulation('d1-sim', 'user-1', 'app-review');
    expect(calls.some((query) => query.includes('INSERT INTO applications'))).toBe(true);
  });

  it('does not allow an unrelated alternative consent to connect DigiLocker employment', async () => {
    const consent = await grant('exact-provider-consent', ['application_baseline', 'alternative_cashflow']);
    const response = await request('/api/providers/digilocker_employment/connect', {
      method: 'POST',
      headers: { ...auth(), 'content-type': 'application/json' },
      body: JSON.stringify({ simulationId: 'exact-provider-consent', consentId: consent.receipt.consentId }),
    });
    expect(response.status).toBe(403);
  });

  it('propagates D1 write failures instead of silently using memory', async () => {
    const db = {
      prepare() {
        return { bind: () => ({ run: async () => { throw new Error('d1 unavailable'); }, first: async () => null, all: async () => ({ results: [] }) }) };
      },
    } as unknown as D1Database;
    const d1Repository = new D1SimulationRepository(db);
    await expect(d1Repository.saveConsent({
      schemaVersion: '1.1', consentId: 'd1-consent', simulationId: 'd1-failure', applicantId: 'app-review',
      purposes: ['application_baseline'], categories: ['bureau'], source: 'synthetic_fixture', status: 'granted',
      grantedAt: '2026-08-08T00:00:00.000Z', revokedAt: null, retention: 'demo_session', receiptHash: 'sha256:invalid', identityProvider: 'clerk', clerkUserId: 'user-1',
    })).rejects.toThrow('d1 unavailable');
  });
});
