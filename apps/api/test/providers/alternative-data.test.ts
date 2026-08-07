import { describe, expect, it } from 'vitest';

import type { ConsentContext } from '@underwriting/shared';
import {
  ConsentRequiredError,
  MockAccountAggregatorProvider,
  MockDigiLockerProvider,
  normalizeAccountAggregatorData,
  normalizeDigiLockerData,
} from '../../src/providers/index.ts';

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

describe('alternative data providers', () => {
  it('denies account access when the required consent is absent', () => {
    const provider = new MockAccountAggregatorProvider();

    expect(() => provider.fetch({ persona: 'stable_salaried', consent: undefined })).toThrow(ConsentRequiredError);
  });

  it('returns deterministic synthetic transactions for each supported persona', () => {
    const provider = new MockAccountAggregatorProvider();
    const first = provider.fetch({ persona: 'stable_salaried', consent: accountConsent });
    const second = provider.fetch({ persona: 'stable_salaried', consent: accountConsent });
    const irregular = provider.fetch({ persona: 'irregular_income', consent: accountConsent });

    expect(first).toEqual(second);
    expect(first.data.transactions.length).toBeGreaterThan(0);
    expect(first.data.transactions.some((transaction) => transaction.type === 'credit')).toBe(true);
    expect(first.data.transactions.some((transaction) => transaction.type === 'debit')).toBe(true);
    expect(irregular.data.syntheticAccountId).not.toBe(first.data.syntheticAccountId);
    expect(first.consent.consentReference).toBe(accountConsent.consentReference);
    expect(first.provenance.source).toBe('account_aggregator');
  });

  it('returns verified synthetic employment and education records only with matching consent', () => {
    const provider = new MockDigiLockerProvider();
    const employment = provider.fetch({ recordType: 'employment', consent: employmentConsent });
    const education = provider.fetch({ recordType: 'education', consent: educationConsent });

    expect(employment.data.recordType).toBe('employment');
    expect(employment.data.records[0]).toMatchObject({ verificationStatus: 'verified', issuer: 'DigiLocker' });
    expect(education.data.recordType).toBe('education');
    expect(education.data.records[0]).toMatchObject({ verificationStatus: 'verified', issuer: 'DigiLocker' });
  });

  it('normalizes employment and education into evidence without calculating risk', () => {
    const provider = new MockDigiLockerProvider();
    const employment = provider.fetch({ recordType: 'employment', consent: employmentConsent });
    const education = provider.fetch({ recordType: 'education', consent: educationConsent });
    const normalized = normalizeDigiLockerData([employment, education]);

    expect(normalized.employmentConsistency).toBe('consistent');
    expect(normalized.educationCredentialConsistency).toBe('consistent');
    expect(normalized.verificationStatus).toBe('verified');
    expect(normalized.provenanceReferences).toEqual(expect.arrayContaining([
      employment.provenance.reference,
      education.provenance.reference,
    ]));
    expect(normalized.consentReferences).toEqual(expect.arrayContaining([
      employment.consent.consentReference,
      education.consent.consentReference,
    ]));
    expect(JSON.stringify(normalized)).not.toMatch(/score|risk|decision/i);
  });

  it('normalizes account transactions while preserving provenance and consent references', () => {
    const response = new MockAccountAggregatorProvider().fetch({ persona: 'stable_salaried', consent: accountConsent });
    const normalized = normalizeAccountAggregatorData(response);

    expect(normalized.source).toBe('account_aggregator');
    expect(normalized.evidence).toHaveLength(response.data.transactions.length);
    expect(normalized.evidence[0]).toMatchObject({ type: 'transaction', verificationStatus: 'observed' });
    expect(normalized.provenanceReferences).toEqual([response.provenance.reference]);
    expect(normalized.consentReferences).toEqual([accountConsent.consentReference]);
    expect(normalized.employmentConsistency).toBe('not_applicable');
    expect(normalized.educationCredentialConsistency).toBe('not_applicable');
  });

  it('does not expose protected attributes or underwriting outputs', () => {
    const account = new MockAccountAggregatorProvider().fetch({ persona: 'anomaly_heavy', consent: accountConsent });
    const employment = new MockDigiLockerProvider().fetch({ recordType: 'employment', consent: employmentConsent });
    const education = new MockDigiLockerProvider().fetch({ recordType: 'education', consent: educationConsent });
    const payload = JSON.stringify({ account, employment, education });

    expect(payload).not.toMatch(/gender|caste|religion|prestige|ranking|institutionQuality|riskScore|riskBand|underwritingDecision/i);
  });
});
