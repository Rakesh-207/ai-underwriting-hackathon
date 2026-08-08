import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button.tsx';
import { useApplications } from '../hooks/useApplications.tsx';
import { sourceCatalog, type ApplicationDraft, type DataSourceKey } from '../lib/applicationAdapter.ts';

const initialDraft: ApplicationDraft = {
  applicantName: '', address: '', employmentType: '', employer: '', jobTitle: '', employmentTenure: 0,
  monthlyIncome: 0, monthlyObligations: 0, educationCredential: '', requestedAmount: 0, repaymentTenure: 0,
  bureauScore: 0, purpose: '', sources: {
    accountAggregator: { consent: false, state: 'Not connected' },
    employmentDigiLocker: { consent: false, state: 'Not connected' },
    educationDigiLocker: { consent: false, state: 'Not connected' },
    professional: { consent: false, state: 'Not connected' },
  },
};

export function NewApplication() {
  const [draft, setDraft] = useState(initialDraft);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { runReview } = useApplications();
  const navigate = useNavigate();
  const set = (key: keyof ApplicationDraft, value: string | number) => setDraft((current) => ({ ...current, [key]: value }));
  const toggleSource = (key: DataSourceKey) => setDraft((current) => ({ ...current, sources: { ...current.sources, [key]: { consent: !current.sources[key].consent, state: current.sources[key].consent ? 'Not connected' : 'Connected' } } }));
  const next = () => {
    const required = step === 0 ? ['applicantName', 'address', 'employmentType', 'employer', 'jobTitle', 'educationCredential'] : step === 1 ? ['requestedAmount', 'repaymentTenure', 'bureauScore', 'purpose'] : [];
    if (required.some((key) => !draft[key as keyof ApplicationDraft])) { setError('Complete each required field before continuing.'); return; }
    setError('');
    setStep((current) => Math.min(3, current + 1));
  };
  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const application = await runReview(draft);
      navigate(`/app/applications/${application.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The assessment could not be started.');
    } finally {
      setSubmitting(false);
    }
  };
  return <div className="mx-auto max-w-4xl space-y-9">
    <header><Link className="text-sm font-semibold text-[var(--app-accent)] hover:underline" to="/app/applications">Back to applications</Link><p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-[var(--app-accent)]">New application</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">Apply for a loan</h1><p className="mt-3 max-w-2xl text-[var(--app-muted)]">Build an API-backed synthetic application with purpose-bound consent and optional mock sources.</p></header>
    <div className="grid grid-cols-4 gap-2 border-y border-[var(--app-border)] py-5">{['Applicant details', 'Loan request', 'Consent & data sources', 'Review'].map((label, index) => <div key={label} className={['border-t-2 pt-3 text-xs font-semibold', index <= step ? 'border-[var(--app-accent)] text-[var(--app-ink)]' : 'border-[var(--app-border)] text-[var(--app-muted)]'].join(' ')}><span className="mr-1 font-mono">0{index + 1}</span>{label}</div>)}</div>
    {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
    {step === 0 && <FormSection title="Applicant details" description="These synthetic fields establish the application baseline."><div className="grid gap-5 sm:grid-cols-2"><Field label="Synthetic name" value={draft.applicantName} onChange={(value) => set('applicantName', value)} /><Field label="Synthetic address" value={draft.address} onChange={(value) => set('address', value)} /><Field label="Employment type" value={draft.employmentType} onChange={(value) => set('employmentType', value)} /><Field label="Employer" value={draft.employer} onChange={(value) => set('employer', value)} /><Field label="Job title" value={draft.jobTitle} onChange={(value) => set('jobTitle', value)} /><Field label="Education credential" value={draft.educationCredential} onChange={(value) => set('educationCredential', value)} /><Field label="Employment tenure (months)" type="number" value={draft.employmentTenure || ''} onChange={(value) => set('employmentTenure', Number(value))} /><Field label="Monthly income" type="number" value={draft.monthlyIncome || ''} onChange={(value) => set('monthlyIncome', Number(value))} /><Field label="Monthly obligations" type="number" value={draft.monthlyObligations || ''} onChange={(value) => set('monthlyObligations', Number(value))} /></div></FormSection>}
    {step === 1 && <FormSection title="Loan request" description="Define the request assessed by the deterministic underwriting engine."><div className="grid gap-5 sm:grid-cols-2"><Field label="Requested amount" type="number" value={draft.requestedAmount || ''} onChange={(value) => set('requestedAmount', Number(value))} /><Field label="Repayment tenure (months)" type="number" value={draft.repaymentTenure || ''} onChange={(value) => set('repaymentTenure', Number(value))} /><Field label="Synthetic bureau score" type="number" value={draft.bureauScore || ''} onChange={(value) => set('bureauScore', Number(value))} /><Field label="Purpose" value={draft.purpose} onChange={(value) => set('purpose', value)} /></div></FormSection>}
    {step === 2 && <FormSection title="Purpose-bound consent" description="Connect only the mock sources you explicitly authorize. Professional data remains unavailable in this candidate."><div className="space-y-4">{sourceCatalog.map((source) => { const selected = draft.sources[source.key].consent; const unavailable = source.key === 'professional'; return <div key={source.key} className="rounded-lg border border-[var(--app-border)] p-5"><div className="flex items-start justify-between gap-4"><div><p className="font-semibold">{source.name}</p><p className="mt-1 text-xs text-[var(--app-muted)]">{source.provider}</p><p className="mt-3 text-sm text-[var(--app-muted)]">{source.purpose}</p></div><Button disabled={unavailable} variant={selected ? 'secondary' : 'outline'} size="sm" onClick={() => toggleSource(source.key)}>{unavailable ? 'Not available' : selected ? 'Selected' : 'Connect'}</Button></div><p className="mt-3 text-xs text-[var(--app-muted)]">Scope: {source.scope}</p></div>; })}</div></FormSection>}
    {step === 3 && <FormSection title="Review and run" description="The API will create the application, record consent receipts, connect selected mock providers, and run deterministic scoring."><dl className="divide-y divide-[var(--app-border)] border-y border-[var(--app-border)]">{[['Applicant', draft.applicantName], ['Employer', draft.employer], ['Monthly income', `$${draft.monthlyIncome.toLocaleString()}`], ['Requested amount', `$${draft.requestedAmount.toLocaleString()}`], ['Purpose', draft.purpose], ['Connected sources', Object.entries(draft.sources).filter(([, source]) => source.consent).map(([key]) => key).join(', ') || 'Baseline only']].map(([label, value]) => <div key={label} className="grid gap-1 py-4 sm:grid-cols-[180px_1fr]"><dt className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">{label}</dt><dd className="text-sm font-medium">{value}</dd></div>)}</dl></FormSection>}
    <div className="flex justify-between"><Button variant="outline" disabled={step === 0 || submitting} onClick={() => setStep((current) => current - 1)}>Back</Button>{step < 3 ? <Button onClick={next}>Continue</Button> : <Button disabled={submitting} onClick={() => void submit()}>{submitting ? 'Running assessment...' : 'Create and assess application'}</Button>}</div>
  </div>;
}

function FormSection({ title, description, children }: { title: string; description: string; children: ReactNode }) { return <section><h2 className="text-2xl font-semibold">{title}</h2><p className="mt-2 text-sm text-[var(--app-muted)]">{description}</p><div className="mt-8">{children}</div></section>; }
function Field({ label, value, onChange, type = 'text' }: { label: string; value: string | number; onChange: (value: string) => void; type?: string }) { return <label className="block"><span className="text-sm font-semibold">{label}</span><input className="mt-2 block h-11 w-full rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-sm outline-none focus:border-[var(--app-accent)] focus:ring-2 focus:ring-[var(--app-accent)]/20" type={type} value={value} onChange={(event) => onChange(event.target.value)} required /></label>; }
