import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { ApplicationStatus, RiskBand } from '../components/ApplicationStatus.tsx';
import { Button } from '../components/ui/button.tsx';
import { AgentChatPanel } from '../features/agent-chat/index.ts';
import { useApplications } from '../hooks/useApplications.tsx';
import { createAgentChatTransport } from '../lib/agentChat.ts';
import { createApiClient, type ApiApplication } from '../lib/api.ts';
import type { AuditEvent, ConsentReceipt, FairnessReport, ScoreResult } from '@underwriting/shared';

export function ApplicationDetail() {
  const { id = '' } = useParams();
  const { getToken } = useAuth();
  const { find } = useApplications();
  const api = useMemo(() => createApiClient({ getToken }), [getToken]);
  const application = find(id);
  const [apiApplication, setApiApplication] = useState<ApiApplication | null>(application?.apiApplication ?? null);
  const [score, setScore] = useState<ScoreResult | null>(application?.review?.score ?? null);
  const [fairness, setFairness] = useState<FairnessReport | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [receipts, setReceipts] = useState<ConsentReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [behaviorValue, setBehaviorValue] = useState(0.9);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    void Promise.all([api.getApplication(id), api.getFairness({ simulationId: id }), api.getAudit(id), api.getConsents(id)])
      .then(([detail, fairnessResponse, auditResponse, consentResponse]) => {
        if (!active) return;
        setApiApplication(detail.application);
        setScore(detail.application.latestScore);
        setFairness(fairnessResponse.report);
        setAuditEvents(auditResponse.events);
        setReceipts(consentResponse.receipts);
        setError('');
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Application data could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, id]);

  const refresh = async () => {
    if (!id) return;
    const [detail, auditResponse, consentResponse] = await Promise.all([api.getApplication(id), api.getAudit(id), api.getConsents(id)]);
    setApiApplication(detail.application);
    setScore(detail.application.latestScore);
    setAuditEvents(auditResponse.events);
    setReceipts(consentResponse.receipts);
  };

  const grantBehaviorConsent = async () => {
    if (!apiApplication) return;
    try {
      await api.createConsent({ simulationId: id, applicantId: apiApplication.applicantId, purposes: ['behavior_updates'], categories: ['behavior_updates'], source: 'synthetic_fixture' });
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Behavior consent could not be recorded.'); }
  };

  const applyBehavior = async () => {
    const consent = receipts.find((item) => item.status === 'granted' && item.purposes.includes('behavior_updates'));
    if (!consent || !apiApplication) { await grantBehaviorConsent(); return; }
    try {
      const response = await api.applyBehavior({ simulationId: id, applicantId: apiApplication.applicantId, consentId: consent.consentId, eventType: 'income_observation', value: behaviorValue });
      setScore(response.result);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Behavior update could not be applied.'); }
  };

  if (!application && !apiApplication && loading) return <div className="mx-auto max-w-2xl py-16 text-center">Loading application...</div>;
  if (!application && !apiApplication) return <div className="mx-auto max-w-2xl py-16 text-center"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--app-accent)]">Application not found</p><h1 className="mt-4 text-3xl font-semibold tracking-tight">This application does not exist.</h1><Link className="mt-7 inline-flex" to="/app/applications"><Button>Applications</Button></Link></div>;

  const name = application?.draft.applicantName ?? apiApplication?.applicantId ?? 'Synthetic applicant';
  const requestedAmount = application?.draft.requestedAmount ?? apiApplication?.application.requestedAmount ?? 0;
  const connectedProviders = apiApplication ? Object.entries(apiApplication.providers).filter(([, value]) => Boolean(value)).map(([source]) => source) : [];
  const transport = createAgentChatTransport(id, api);
  return <div className="mx-auto max-w-6xl space-y-8 pr-0 lg:pr-10">
    <header className="flex flex-col justify-between gap-6 border-b border-[var(--app-border)] pb-8 sm:flex-row sm:items-end"><div><Link className="text-sm font-semibold text-[var(--app-accent)] hover:underline" to="/app/applications">Back to applications</Link><p className="mt-7 font-mono text-xs text-[var(--app-muted)]">{id}</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">{name}</h1><p className="mt-3 text-sm text-[var(--app-muted)]">API-backed synthetic application · requested ${requestedAmount.toLocaleString()}</p></div><ApplicationStatus status={application?.status ?? 'Processing'} /></header>
    {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
    {score ? <><section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"><div className="rounded-xl bg-[var(--app-ink)] p-7 text-[var(--app-surface)] sm:p-9"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#c6d3c9]">Deterministic reliability score</p><div className="mt-6 flex items-end gap-4"><span className="text-7xl font-semibold tracking-[-0.08em]">{score.dynamicScore}</span><span className="pb-3 text-sm text-[#c6d3c9]">/ 900</span></div><p className="mt-3 max-w-md text-sm leading-6 text-[#c6d3c9]">Baseline {score.baselineScore} · alternative contribution {score.alternativeContribution >= 0 ? '+' : ''}{score.alternativeContribution}. This is not a lending outcome.</p><div className="mt-6"><RiskBand band={score.riskBand} /></div></div><div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1"><Metric label="Model" value={score.modelVersion} /><Metric label="Fraud review" value={score.fraudReview.status} /><Metric label="Providers" value={connectedProviders.length} /></div></section><section className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6"><SectionTitle title="Evidence and provenance" /><div className="space-y-3">{score.evidence.map((item) => <div key={item.featureKey} className="flex flex-col justify-between gap-2 border-b border-[var(--app-border)] pb-3 last:border-0 sm:flex-row"><div><p className="font-semibold">{item.label} <span className="ml-2 text-xs text-[var(--app-muted)]">{item.direction}</span></p><p className="mt-1 text-sm text-[var(--app-muted)]">{item.explanation}</p></div><span className={item.signedPoints >= 0 ? 'font-semibold text-green-700' : 'font-semibold text-red-700'}>{item.signedPoints > 0 ? '+' : ''}{item.signedPoints} pts</span></div>)}</div><div className="mt-6 border-t border-[var(--app-border)] pt-5"><h3 className="text-sm font-semibold">Provenance</h3><div className="mt-3 grid gap-2 text-xs text-[var(--app-muted)] sm:grid-cols-2">{score.provenance.map((ref) => <div key={`${ref.category}-${ref.fixtureId}`} className="rounded-md bg-[var(--app-bg)] p-3"><span className="font-semibold">{ref.category}</span><span className="ml-2 font-mono">{ref.source} · {ref.fixtureId}</span></div>)}</div></div></section></> : <section className="rounded-xl border border-dashed border-[var(--app-border)] p-8"><h2 className="text-xl font-semibold">Score not yet available</h2><p className="mt-2 text-sm text-[var(--app-muted)]">Grant baseline consent and run the deterministic assessment from the application workflow.</p></section>}
    <section className="grid gap-6 lg:grid-cols-2"><div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6"><SectionTitle title="Behavior update" /><p className="text-sm leading-6 text-[var(--app-muted)]">Updates are synthetic, consent-gated, and recalculated by the API engine.</p><div className="mt-5 flex flex-wrap items-end gap-3"><label className="text-sm font-semibold">Observed value<input className="mt-2 block h-10 w-32 rounded-md border border-[var(--app-border)] px-3" type="number" min="0" max="1" step="0.01" value={behaviorValue} onChange={(event) => setBehaviorValue(Number(event.target.value))} /></label><Button onClick={() => void applyBehavior()}>Apply update</Button></div></div><div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6"><SectionTitle title="Connected providers" /><div className="space-y-2 text-sm">{['account_aggregator', 'digilocker_employment', 'digilocker_education'].map((source) => <div className="flex justify-between border-b border-[var(--app-border)] py-2 last:border-0" key={source}><span>{source}</span><span className="font-semibold">{connectedProviders.includes(source) ? 'Connected' : 'Not connected'}</span></div>)}</div></div></section>
    {fairness && <section className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6"><SectionTitle title="Fairness diagnostics" /><p className="text-sm text-[var(--app-muted)]">Synthetic evaluation metadata only; not a lending decision.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[580px] text-left text-sm"><thead><tr className="border-b border-[var(--app-border)] text-xs uppercase tracking-wide text-[var(--app-muted)]"><th className="px-3 py-3">Cohort</th><th className="px-3 py-3">Sample</th><th className="px-3 py-3">Strong/stable</th><th className="px-3 py-3">Adverse impact</th></tr></thead><tbody>{fairness.cohorts.map((row) => <tr className="border-b border-[var(--app-border)] last:border-0" key={row.cohort}><td className="px-3 py-3 font-medium">{row.cohort}</td><td className="px-3 py-3">{row.sampleCount}</td><td className="px-3 py-3">{Math.round(row.strongOrStableRate * 100)}%</td><td className="px-3 py-3">{row.adverseImpactRatio ?? 'n/a'}</td></tr>)}</tbody></table></div></section>}
    <section className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6"><SectionTitle title="Audit events" /><ol className="space-y-3">{auditEvents.map((event) => <li className="border-l-2 border-[var(--app-accent)]/30 pl-4" key={event.eventId}><p className="font-semibold">{event.eventType}</p><p className="text-xs text-[var(--app-muted)]">{event.occurredAt} · {event.eventId}</p></li>)}</ol>{auditEvents.length === 0 && <p className="text-sm text-[var(--app-muted)]">No API audit events yet.</p>}</section>
    <AgentChatPanel transport={transport} title="Underwriting agent · completed responses" />
  </div>;
}

function SectionTitle({ title }: { title: string }) { return <h2 className="mb-4 text-xl font-semibold tracking-tight">{title}</h2>; }
function Metric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--app-muted)]">{label}</p><p className="mt-2 text-lg font-semibold">{value}</p></div>; }
