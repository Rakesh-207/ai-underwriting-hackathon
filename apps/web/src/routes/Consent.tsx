import type { ConsentPurpose } from '@underwriting/shared';
import { Button } from '../components/ui/button.tsx';
import { Page, Panel, Status, Notice } from '../components/workspace/index.tsx';
import { useConsentState, useSimulation } from '../hooks/useWorkspace.tsx';

const PURPOSES: Array<[ConsentPurpose, string, string]> = [
  ['application_baseline', 'Application baseline', 'Synthetic bureau and salary'],
  ['alternative_cashflow', 'Alternative cashflow', 'Synthetic cashflow stability'],
  ['behavior_updates', 'Behavior updates', 'Synthetic income observations'],
  ['fraud_screening', 'Fraud screening', 'Synthetic velocity rules'],
];

export function Consent() {
  const { receipts, toggle } = useConsentState();
  const { loading, error } = useSimulation();
  return <Page eyebrow="Consent" title="Purpose-bound consent" description="Consent is explicit, granular, and revocable. Clerk identity does not substitute for a consent receipt.">
    <Notice>Grant baseline consent before synthetic applicant data is available. Alternative and behavior signals remain purpose-gated.</Notice>
    {error && <Notice>{error}</Notice>}
    <div className="grid gap-4 md:grid-cols-2">{PURPOSES.map(([purpose, label, category]) => {
      const receipt = receipts.find((item) => item.purposes.includes(purpose));
      const granted = receipt?.status === 'granted';
      return <Panel key={purpose} title={label} description={purpose}><div className="space-y-3"><p className="text-sm text-ink">{category}</p><p className="text-xs text-muted">Source: synthetic_fixture · Retention: demo session</p><div className="flex items-center justify-between gap-3"><Status band={granted ? 'granted' : 'revoked'}>{granted ? 'granted' : 'revoked'}</Status><Button disabled={loading} variant={granted ? 'outline' : 'primary'} size="sm" onClick={() => void toggle(purpose)}>{granted ? 'Revoke consent' : 'Grant consent'}</Button></div></div></Panel>;
    })}</div>
  </Page>;
}
