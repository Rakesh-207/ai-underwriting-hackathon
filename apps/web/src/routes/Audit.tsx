import { useEffect } from 'react';
import { Page, Panel, Status, Notice } from '../components/workspace/index.tsx';
import { useSimulation } from '../hooks/useWorkspace.tsx';

export function Audit() {
  const { auditEvents, dynamicScore, loadAudit, loading, error } = useSimulation();
  useEffect(() => { if (auditEvents.length === 0) void loadAudit(); }, [auditEvents.length, loadAudit]);
  return <Page eyebrow="Audit" title="Audit trail" description="Trace consent, score, behavior, fairness, provenance, and review signals returned by the API."><Notice>{error ?? (loading ? 'Loading audit trail...' : 'This synthetic audit does not establish regulatory compliance, accuracy, or a lending decision.')}</Notice>{dynamicScore && <Panel title="Fraud review"><div className="flex items-center gap-3"><Status band={dynamicScore.fraudReview.status}>{dynamicScore.fraudReview.status}</Status><span className="text-sm text-muted">{dynamicScore.fraudReview.action === 'manual_review' ? 'Manual review signal' : 'No action'}</span></div><ul className="mt-4 space-y-2 text-sm text-muted">{dynamicScore.fraudReview.flags.map((flag) => <li key={flag.ruleKey}><strong className="text-ink">{flag.ruleKey}</strong>: {flag.explanation}</li>)}</ul></Panel>}<Panel title="Events">{auditEvents.length === 0 && !loading ? <p className="text-sm text-muted">No audit events are available until an API operation has completed.</p> : <ol className="space-y-4">{auditEvents.map((event) => <li className="border-l-2 border-primary/30 pl-4" key={event.eventId}><p className="font-medium">{event.eventType} <span className="ml-2 font-mono text-xs text-muted">{event.eventId}</span></p><p className="mt-1 text-sm text-muted">{event.occurredAt}</p></li>)}</ol>}</Panel></Page>;
}
