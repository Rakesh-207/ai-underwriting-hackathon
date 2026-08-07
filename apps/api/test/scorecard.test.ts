import { describe, expect, it } from 'vitest';
import type { ApplicantProfile, ConsentReceipt, ScoreRequest } from '@underwriting/shared';
import { computeScore } from '../src/engine/scorecard.ts';

const applicant: ApplicantProfile = {
  applicantId: 'app-hero',
  displayName: 'Synthetic Applicant',
  baseline: {
    bureauScore: 720,
    monthlyIncome: 80000,
    monthlyDebt: 24000,
    employmentMonths: 36,
    applicationCompleteness: 0.95,
  },
  alternative: {
    cashflowStability: 0.9,
    incomeConsistency: 0.88,
    savingsBufferMonths: 4,
    onTimePaymentRate: 0.97,
  },
  provenance: [],
};

const consent: ConsentReceipt = {
  schemaVersion: '1.1',
  consentId: 'con-alt',
  simulationId: 'sim-1',
  applicantId: 'app-hero',
  purposes: ['alternative_cashflow'],
  categories: ['cashflow'],
  source: 'synthetic_fixture',
  status: 'granted',
  grantedAt: '2026-01-01T00:00:00.000Z',
  revokedAt: null,
  retention: 'demo_session',
  receiptHash: 'hash',
  identityProvider: 'clerk',
  clerkUserId: 'user-1',
};

const request: ScoreRequest = {
  schemaVersion: '1.1',
  simulationId: 'sim-1',
  applicant,
  consentReceipts: [consent],
  behaviorUpdates: [],
  mode: 'consented_dynamic',
};

describe('deterministic scorecard', () => {
  it('returns byte-equivalent results for identical inputs', () => {
    expect(computeScore(request, '2026-01-01T00:00:00.000Z')).toEqual(
      computeScore(request, '2026-01-01T00:00:00.000Z'),
    );
  });

  it('keeps alternative features consent-gated and excludes protected traits', () => {
    const result = computeScore(request, '2026-01-01T00:00:00.000Z');
    expect(result.alternativeContribution).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toMatch(/gender|caste|religion|race/i);
    expect(result.scoreMeaning).toBe('higher_is_stronger_reliability');
    expect(result.evidence.every((item) => item.provenanceRef.length > 0)).toBe(true);
  });

  it('excludes alternative contribution after consent revocation', () => {
    const revoked = { ...consent, status: 'revoked' as const, revokedAt: '2026-01-02T00:00:00.000Z' };
    const result = computeScore({ ...request, consentReceipts: [revoked] }, '2026-01-01T00:00:00.000Z');
    expect(result.alternativeContribution).toBe(0);
  });
});
