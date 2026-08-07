import { useState } from 'react';
import { consentReceipts } from '../lib/fixtures.ts';
import type { ConsentPurpose } from '@underwriting/shared';

export function useConsentState() {
  const [receipts, setReceipts] = useState(consentReceipts);
  const toggle = (purpose: ConsentPurpose) => setReceipts((current) => current.map((receipt) => receipt.purposes.includes(purpose) ? { ...receipt, status: receipt.status === 'granted' ? 'revoked' : 'granted', revokedAt: receipt.status === 'granted' ? new Date().toISOString() : null } : receipt));
  return { receipts, toggle };
}

export function hasConsent(purpose: ConsentPurpose) { return consentReceipts.some((receipt) => receipt.purposes.includes(purpose) && receipt.status === 'granted'); }
