import type { ConsentContext, RawAccountAggregatorData, RawProviderResponse } from '@underwriting/shared';
import { requireConsent } from './consent.ts';

export type AccountAggregatorPersona = 'stable_salaried' | 'irregular_income' | 'anomaly_heavy';

const CONSENT_SCOPE = ['account_transactions'] as const;
const RETRIEVED_AT = '2026-08-08T10:05:00.000Z';

export class MockAccountAggregatorProvider {
  readonly source = 'account_aggregator' as const;

  fetch(input: { persona: AccountAggregatorPersona; consent?: ConsentContext }): RawProviderResponse<RawAccountAggregatorData> {
    const consent = requireConsent(input.consent, this.source, CONSENT_SCOPE);
    const data = accountData(input.persona);

    return {
      data,
      consent,
      provenance: {
        source: this.source,
        provider: 'mock-account-aggregator',
        reference: `aa:${data.syntheticAccountId}:${data.statementPeriod.to}`,
        retrievedAt: RETRIEVED_AT,
      },
    };
  }
}

function accountData(persona: AccountAggregatorPersona): RawAccountAggregatorData {
  const datasets: Record<AccountAggregatorPersona, RawAccountAggregatorData> = {
    stable_salaried: {
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
    irregular_income: {
      syntheticAccountId: 'aa-irregular-001',
      statementPeriod: { from: '2026-01-01', to: '2026-03-31' },
      transactions: [
        { transactionId: 'irregular-001', postedAt: '2026-01-12', type: 'credit', amount: 42000, description: 'CLIENT PAYMENT', balanceAfter: 60000 },
        { transactionId: 'irregular-002', postedAt: '2026-02-18', type: 'credit', amount: 125000, description: 'PROJECT PAYMENT', balanceAfter: 149000 },
        { transactionId: 'irregular-003', postedAt: '2026-03-22', type: 'credit', amount: 18000, description: 'CLIENT PAYMENT', balanceAfter: 23000 },
        { transactionId: 'irregular-004', postedAt: '2026-03-28', type: 'debit', amount: 31000, description: 'UTILITY PAYMENT', balanceAfter: -8000 },
      ],
      balance: { opening: 18000, closing: -8000, currency: 'INR' },
    },
    anomaly_heavy: {
      syntheticAccountId: 'aa-anomaly-001',
      statementPeriod: { from: '2026-01-01', to: '2026-03-31' },
      transactions: [
        { transactionId: 'anomaly-001', postedAt: '2026-01-03', type: 'credit', amount: 500000, description: 'UNUSUAL TRANSFER', balanceAfter: 512000 },
        { transactionId: 'anomaly-002', postedAt: '2026-01-04', type: 'debit', amount: 498000, description: 'RAPID OUTWARD TRANSFER', balanceAfter: 14000 },
        { transactionId: 'anomaly-003', postedAt: '2026-02-14', type: 'debit', amount: 45000, description: 'RETURNED PAYMENT', balanceAfter: -31000 },
      ],
      balance: { opening: 12000, closing: -31000, currency: 'INR' },
    },
  };

  return datasets[persona];
}
