import { describe, expect, it } from 'vitest';
import type { ConsentReceipt } from '@underwriting/shared';
import { canonicalReceiptFields, receiptHash, verifyReceiptHash } from '../src/receipt-hash.ts';

const receipt: ConsentReceipt = {
  schemaVersion: '1.1', consentId: 'con-1', simulationId: 'sim-1', applicantId: 'app-hero',
  purposes: ['alternative_cashflow', 'application_baseline'], categories: ['salary', 'bureau'],
  source: 'synthetic_fixture', status: 'granted', grantedAt: '2026-01-01T00:00:00.000Z', revokedAt: null,
  retention: 'demo_session', receiptHash: '', identityProvider: 'clerk', clerkUserId: 'user-1',
};

describe('consent receipt hash', () => {
  it('uses explicit canonical ordering and repeats for identical fields', async () => {
    const first = await receiptHash(receipt);
    const second = await receiptHash({ ...receipt, purposes: [...receipt.purposes].reverse(), categories: [...receipt.categories].reverse() });
    expect(canonicalReceiptFields(receipt)).toContain('"consentId":"con-1"');
    expect(first).toBe(second);
  });

  it('diverges when a signed receipt field changes and verifies persisted values', async () => {
    const hashed = { ...receipt, receiptHash: await receiptHash(receipt) };
    expect(await verifyReceiptHash(hashed)).toBe(true);
    expect(await verifyReceiptHash({ ...hashed, categories: ['bureau', 'cashflow'] })).toBe(false);
    expect(await verifyReceiptHash({ ...hashed, receiptHash: `sha256:${'0'.repeat(64)}` })).toBe(false);
  });
});
