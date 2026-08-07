import { describe, expect, it } from 'vitest';
import type {
  ConsentContext,
  ProviderProvenance,
  RawDigiLockerData,
  RawProviderResponse,
  RawAccountAggregatorData,
} from '@underwriting/shared';
import {
  PROTECTED_INPUT_FIELDS,
  ProtectedInputError,
  recalculateWithBehaviorUpdate,
  riskBandForScore,
  scoreApplication,
  type UnderwritingEngineInput,
} from '../src/index.ts';

const accountConsent: ConsentContext = {
  source: 'account_aggregator',
  purpose: 'cashflow_analysis',
  scopes: ['account_transactions'],
  timestamp: '2026-08-08T10:00:00.000Z',
  consentReference: 'consent-account-1',
};
const employmentConsent: ConsentContext = {
  source: 'digilocker_employment',
  purpose: 'employment_verification',
  scopes: ['employment_records'],
  timestamp: '2026-08-08T10:00:00.000Z',
  consentReference: 'consent-employment-1',
};
const educationConsent: ConsentContext = {
  source: 'digilocker_education',
  purpose: 'education_verification',
  scopes: ['education_records'],
  timestamp: '2026-08-08T10:00:00.000Z',
  consentReference: 'consent-education-1',
};

const accountProvenance: ProviderProvenance = {
  source: 'account_aggregator',
  provider: 'mock-account-aggregator',
  reference: 'aa:stable-001:2026-03-31',
  retrievedAt: '2026-08-08T10:05:00.000Z',
};
const employmentProvenance: ProviderProvenance = {
  source: 'digilocker_employment',
  provider: 'mock-digilocker',
  reference: 'digilocker:employment:document-001',
  retrievedAt: '2026-08-08T10:06:00.000Z',
};
const educationProvenance: ProviderProvenance = {
  source: 'digilocker_education',
  provider: 'mock-digilocker',
  reference: 'digilocker:education:document-001',
  retrievedAt: '2026-08-08T10:06:00.000Z',
};

const stableAccount: RawProviderResponse<RawAccountAggregatorData> = {
  consent: accountConsent,
  provenance: accountProvenance,
  data: {
    syntheticAccountId: 'aa-stable-001',
    statementPeriod: { from: '2026-01-01', to: '2026-03-31' },
    transactions: [
      { transactionId: 'stable-001', postedAt: '2026-01-01', type: 'credit', amount: 85000, description: 'SALARY ACME SYSTEMS', balanceAfter: 120000 },
      { transactionId: 'stable-002', postedAt: '2026-01-05', type: 'debit', amount: 22000, description: 'RENT', balanceAfter: 98000 },
      { transactionId: 'stable-003', postedAt: '2026-02-01', type: 'credit', amount: 85000, description: 'SALARY ACME SYSTEMS', balanceAfter: 183000 },
      { transactionId: 'stable-004', postedAt: '2026-03-01', type: 'credit', amount: 85000, description: 'SALARY ACME SYSTEMS', balanceAfter: 246000 },
    ],
    balance: { opening: 35000, closing: 246000, currency: 'INR' },
  },
};

const employment: RawProviderResponse<Extract<RawDigiLockerData, { recordType: 'employment' }>> = {
  consent: employmentConsent,
  provenance: employmentProvenance,
  data: {
    recordType: 'employment',
    records: [{
      documentId: 'employment-document-001', issuer: 'DigiLocker', employer: 'Acme Systems Pvt Ltd', role: 'Software Engineer',
      employmentType: 'full_time', startDate: '2022-06-01', endDate: null, verificationStatus: 'verified', issuedDate: '2026-07-01',
      provenanceReference: employmentProvenance.reference,
    }],
  },
};

const education: RawProviderResponse<Extract<RawDigiLockerData, { recordType: 'education' }>> = {
  consent: educationConsent,
  provenance: educationProvenance,
  data: {
    recordType: 'education',
    records: [{
      documentId: 'education-document-001', issuer: 'DigiLocker', credentialType: 'Bachelor of Technology', fieldOfStudy: 'Computer Science',
      institution: 'Example Technical University', completionYear: 2022, verificationStatus: 'verified', issuedDate: '2022-08-15',
      provenanceReference: educationProvenance.reference,
    }],
  },
};

function input(overrides: Partial<UnderwritingEngineInput> = {}): UnderwritingEngineInput {
  return {
    applicantId: 'applicant-001',
    application: { bureauScore: 780, monthlyIncome: 85000, monthlyObligations: 22000, requestedAmount: 400000, loanTenureMonths: 24 },
    declaredEmployment: { employer: 'Acme Systems Pvt Ltd' },
    accountAggregator: stableAccount,
    employment,
    education,
    behaviorUpdates: [],
    ...overrides,
  };
}

describe('deterministic underwriting feature engine', () => {
  it('returns identical output for identical input', () => {
    expect(scoreApplication(input())).toEqual(scoreApplication(input()));
  });

  it('calculates baseline-only score from application data', () => {
    const result = scoreApplication(input({ accountAggregator: undefined, employment: undefined, education: undefined }));

    expect(result.baselineScore).toBe(result.dynamicScore);
    expect(result.features.incomeConsistency).toBeNull();
    expect(result.evidence.every((item) => item.source === 'application_baseline')).toBe(true);
  });

  it('changes the dynamic score when consented alternative signals are available', () => {
    const baseline = scoreApplication(input({ accountAggregator: undefined, employment: undefined, education: undefined }));
    const dynamic = scoreApplication(input());

    expect(dynamic.dynamicScore).toBeGreaterThan(baseline.dynamicScore);
    expect(dynamic.dynamicScore - baseline.dynamicScore).toBe(dynamic.alternativeContribution);
  });

  it('does not reduce the score when optional consented sources are declined', () => {
    const accountOnly = scoreApplication(input({ employment: undefined, education: undefined }));
    const baseline = scoreApplication(input({ accountAggregator: undefined, employment: undefined, education: undefined }));

    expect(accountOnly.dynamicScore).toBeGreaterThanOrEqual(baseline.dynamicScore);
  });

  it('emits an explainable employment mismatch signal', () => {
    const result = scoreApplication(input({ declaredEmployment: { employer: 'Other Employer Ltd' } }));
    const mismatch = result.evidence.find((item) => item.id === 'employment-declaration-mismatch');

    expect(mismatch).toMatchObject({ source: 'digilocker_employment', direction: 'reduces' });
    expect(mismatch?.consentReference).toBe(employmentConsent.consentReference);
    expect(mismatch?.provenance).toBe(employmentProvenance.reference);
  });

  it('keeps education as evidence but excludes it from score calculation', () => {
    const withEducation = scoreApplication(input());
    const withoutEducation = scoreApplication(input({ education: undefined }));

    expect(withEducation.dynamicScore).toBe(withoutEducation.dynamicScore);
    expect(withEducation.evidence.some((item) => item.source === 'digilocker_education')).toBe(true);
  });

  it('flags duplicate and unusual transactions with source metadata', () => {
    const result = scoreApplication(input({
      accountAggregator: {
        ...stableAccount,
        data: {
          ...stableAccount.data,
          transactions: [
            ...stableAccount.data.transactions,
            { ...stableAccount.data.transactions[0], transactionId: 'stable-duplicate' },
            { transactionId: 'spike-001', postedAt: '2026-03-10', type: 'credit', amount: 300000, description: 'UNUSUAL TRANSFER', balanceAfter: 546000 },
          ],
        },
      },
    }));

    expect(result.anomalies.map((flag) => flag.id)).toEqual(expect.arrayContaining(['duplicate-transaction', 'unusual-transaction-spike']));
    expect(result.anomalies.every((flag) => flag.source === 'account_aggregator' && flag.consentReference === accountConsent.consentReference && flag.provenance === accountProvenance.reference)).toBe(true);
  });

  it('clamps scores and uses the documented band boundaries', () => {
    const low = scoreApplication(input({ application: { bureauScore: 300, monthlyIncome: 1, monthlyObligations: 100000, requestedAmount: 10000000, loanTenureMonths: 6 } }));
    const high = scoreApplication(input({ application: { bureauScore: 900, monthlyIncome: 1000000, monthlyObligations: 0, requestedAmount: 1, loanTenureMonths: 360 } }));

    expect(low.dynamicScore).toBeGreaterThanOrEqual(300);
    expect(high.dynamicScore).toBeLessThanOrEqual(900);
    expect(low.riskBand).toBe('high_attention');
    expect(high.riskBand).toBe('strong');
    expect(riskBandForScore(300)).toBe('high_attention');
    expect(riskBandForScore(549)).toBe('high_attention');
    expect(riskBandForScore(550)).toBe('watch');
    expect(riskBandForScore(649)).toBe('watch');
    expect(riskBandForScore(650)).toBe('moderate');
    expect(riskBandForScore(749)).toBe('moderate');
    expect(riskBandForScore(750)).toBe('strong');
  });

  it('reconciles evidence contributions exactly to the score delta', () => {
    const result = scoreApplication(input());

    expect(result.evidence.reduce((total, item) => total + item.scoreContribution, 0)).toBe(result.dynamicScore - 300);
  });

  it('recalculates behavior updates through the same scorecard without mutation', () => {
    const original = input();
    const before = scoreApplication(original);
    const updated = recalculateWithBehaviorUpdate(original, {
      updateId: 'behavior-001', eventType: 'payment_observation', value: 0.2, observedAt: '2026-08-08T11:00:00.000Z',
      source: 'synthetic_behavior', consentReference: 'consent-behavior-1', provenance: 'behavior:payment-001',
    });
    const repeated = scoreApplication({ ...original, behaviorUpdates: [updated.input.behaviorUpdates[0]] });

    expect(updated.result).toEqual(repeated);
    expect(updated.result.scoreId).not.toBe(before.scoreId);
    expect(original.behaviorUpdates).toHaveLength(0);
  });

  it('retains source, consent, and provenance on every evidence item', () => {
    const result = scoreApplication(input());

    expect(result.evidence.every((item) => item.source && item.consentReference && item.provenance && item.explanation)).toBe(true);
  });

  it('rejects protected traits and proxy fields before scoring', () => {
    expect(PROTECTED_INPUT_FIELDS).toEqual(expect.arrayContaining(['gender', 'caste', 'religion', 'collegeRanking']));
    expect(() => scoreApplication(input({ gender: 'not-a-score-input' } as never))).toThrow(ProtectedInputError);
  });
});
