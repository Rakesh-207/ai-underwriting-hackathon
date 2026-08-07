import { useEffect } from 'react';
import { Page, Panel, Notice } from '../components/workspace/index.tsx';
import { useSimulation } from '../hooks/useWorkspace.tsx';

export function Fairness() {
  const { fairness, loadFairness, loading, error } = useSimulation();
  useEffect(() => { if (!fairness) void loadFairness(); }, [fairness, loadFairness]);
  return <Page eyebrow="Fairness" title="Fairness diagnostic" description="Inspect API-owned parity diagnostics over a fixed synthetic evaluation cohort."><Notice>{error ?? (loading ? 'Loading fairness diagnostic...' : 'Synthetic cohort labels are evaluation metadata, never model inputs.')}</Notice>{fairness && <><Panel title="Cohort comparison"><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b border-border text-xs uppercase tracking-wide text-muted">{['Cohort', 'Sample', 'Strong or stable', 'Selection ratio', 'Adverse impact'].map((header) => <th className="px-3 py-3" key={header}>{header}</th>)}</tr></thead><tbody>{fairness.cohorts.map((row) => <tr className="border-b border-border last:border-0" key={row.cohort}><td className="px-3 py-3 font-medium">{row.cohort}</td><td className="px-3 py-3">{row.sampleCount}</td><td className="px-3 py-3">{Math.round(row.strongOrStableRate * 100)}%</td><td className="px-3 py-3">{row.selectionRateRatio ?? 'n/a'}</td><td className="px-3 py-3">{row.adverseImpactRatio ?? 'n/a'}</td></tr>)}</tbody></table></div></Panel><Panel title="Limitations"><ul className="list-disc space-y-2 pl-5 text-sm text-muted">{fairness.limitations.map((item) => <li key={item}>{item}</li>)}</ul></Panel></>}</Page>;
}
