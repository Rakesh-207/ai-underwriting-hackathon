import { useEffect } from 'react';
import { Page, Panel, Notice } from '../components/workspace/index.tsx';
import { useSimulation } from '../hooks/useWorkspace.tsx';

export function Applicant() {
  const { applicant, loadApplicants, loading, error } = useSimulation();
  useEffect(() => { if (!applicant) void loadApplicants(); }, [applicant, loadApplicants]);
  return <Page eyebrow="Applicant" title="Synthetic applicant" description="Review baseline fields supplied by the API-owned deterministic scorecard.">
    <Notice>{error ?? (loading ? 'Loading applicant data...' : applicant ? 'Synthetic fixture data only. Protected traits and proxy features are excluded.' : 'Grant application-baseline consent to unlock applicant data.')}</Notice>
    {applicant && <Panel title="Baseline application" description={applicant.applicantId}><dl className="grid grid-cols-2 gap-4 text-sm"><div><dt className="text-muted">Bureau score</dt><dd className="mt-1 font-semibold text-ink">{applicant.baseline.bureauScore || 'API scorecard input'}</dd></div><div><dt className="text-muted">Monthly income</dt><dd className="mt-1 font-semibold text-ink">₹{applicant.baseline.monthlyIncome.toLocaleString()}</dd></div><div><dt className="text-muted">Monthly debt</dt><dd className="mt-1 font-semibold text-ink">₹{applicant.baseline.monthlyDebt.toLocaleString()}</dd></div><div><dt className="text-muted">Employment</dt><dd className="mt-1 font-semibold text-ink">{applicant.baseline.employmentMonths} months</dd></div></dl></Panel>}
  </Page>;
}
