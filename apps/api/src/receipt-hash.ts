import type { ConsentReceipt } from '@underwriting/shared';

// Hash input is deliberately ordered and excludes receiptHash itself. Arrays are
// normalized so equivalent consent payloads have the same persisted digest.
export function canonicalReceiptFields(receipt: Omit<ConsentReceipt, 'receiptHash'> | ConsentReceipt): string {
  const normalize = (value: string) => value.trim();
  const ordered = {
    schemaVersion: normalize(receipt.schemaVersion),
    consentId: normalize(receipt.consentId),
    simulationId: normalize(receipt.simulationId),
    applicantId: normalize(receipt.applicantId),
    purposes: [...receipt.purposes].map(normalize).sort(),
    categories: [...receipt.categories].map(normalize).sort(),
    source: normalize(receipt.source),
    status: normalize(receipt.status),
    grantedAt: new Date(receipt.grantedAt).toISOString(),
    revokedAt: receipt.revokedAt === null ? null : new Date(receipt.revokedAt).toISOString(),
    retention: normalize(receipt.retention),
    identityProvider: normalize(receipt.identityProvider),
    clerkUserId: normalize(receipt.clerkUserId),
  };
  return JSON.stringify(ordered);
}

export async function receiptHash(receipt: Omit<ConsentReceipt, 'receiptHash'> | ConsentReceipt): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalReceiptFields(receipt));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export async function verifyReceiptHash(receipt: ConsentReceipt): Promise<boolean> {
  return receipt.receiptHash === await receiptHash(receipt);
}
