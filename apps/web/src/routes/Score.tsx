import { useEffect } from 'react';
import { Page, Panel, Provenance, Status, Notice } from '../components/workspace/index.tsx';
import { useSimulation } from '../hooks/useWorkspace.tsx';

export function Score() {
  const { receipts, baselineScore, dynamicScore, loadScore, loading, error } = useSimulation();
  const baselineConsent = receipts.some((item) => item.status === 'granted' && item.purposes.includes('application_baseline'));
  const dynamicConsent = receipts.some((item) => item.status === 'granted' && item.purposes.includes('alternative_cashflow'));
  useEffect(() => { if (baselineConsent && !baselineScore) void loadScore('baseline_only'); }, [baselineConsent, baselineScore, loadScore]);
  useEffect(() => { if (dynamicConsent && !dynamicScore) void loadScore('consented_dynamic'); }, [dynamicConsent, dynamicScore, loadScore]);
  const score = dynamicScore ?? baselineScore;
  return <Page eyebrow="Score" title="Reliability score" description="Scores and evidence are returned by the deterministic API scorecard. The browser does not calculate results.">
    <Notice>{error ?? (loading ? 'Loading scorecard result...' : !baselineConsent ? 'Grant application-baseline consent to request a score.' : 'Simulation only: this is not an official credit score or lending outcome.')}</Notice>
    {score && <><div className="grid gap-4 sm:grid-cols-3"><Panel title="Baseline score"><p className="text-4xl font-semibold">{score.baselineScore}</p><p className="mt-1 text-sm text-muted">Traditional data only</p></Panel><Panel title="Dynamic score"><p className="text-4xl font-semibold text-primary">{score.dynamicScore}</p><Status band={score.riskBand}>{score.riskBand}</Status></Panel><Panel title="Alternative contribution"><p className="text-4xl font-semibold">+{score.alternativeContribution}</p><p className="mt-1 text-sm text-muted">Consent-gated points</p></Panel></div><Panel title="Evidence ledger"><div className="space-y-3">{score.evidence.map((item) => <div key={item.featureKey} className="grid gap-2 border-b border-border pb-3 last:border-0 sm:grid-cols-[1fr_auto]"><div><p className="font-medium">{item.label} <span className="ml-2 text-xs text-muted">{item.direction}</span></p><p className="text-sm text-muted">{item.explanation}</p></div><p className={item.signedPoints >= 0 ? 'font-semibold text-success' : 'font-semibold text-danger'}>{item.signedPoints > 0 ? '+' : ''}{item.signedPoints} pts</p></div>)}</div></Panel><Provenance refs={score.provenance} /></>}
  </Page>;
}
