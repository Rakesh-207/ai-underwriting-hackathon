import { Page, EmptyState, MetricCard } from './components.tsx';

export function OverviewRoute() { return <Page eyebrow="Overview" title="Simulation overview" description="A compact view of the current synthetic underwriting simulation, its consent boundary, and API-backed result state."><div className="grid gap-4 sm:grid-cols-3"><MetricCard label="Simulation" value="Synthetic demo" detail="No lending outcome is produced" /><MetricCard label="Reliability score" value="Not available" detail="Run a consented score request" /><MetricCard label="Evidence" value="API-backed" detail="Provenance stays attached to data" /></div></Page>; }

export function ConsentRoute() { return <Page eyebrow="Consent" title="Purpose-bound consent" description="Consent is separate from Clerk identity. Alternative data remains unavailable until a server-created receipt exists."><div className="grid gap-4 md:grid-cols-2"><MetricCard label="Receipt state" value="Not available" detail="Create or load a receipt through the API" /><MetricCard label="Retention" value="Demo session" detail="Synthetic data only" /></div></Page>; }

export function ApplicantRoute() { return <Page eyebrow="Applicant" title="Applicant baseline" description="Review synthetic application fields and their provenance. This view remains empty when consented applicant data is unavailable."><EmptyState title="Applicant data is unavailable" body="The API has not returned a consented applicant profile for this simulation." /></Page>; }

export function ScoreRoute() { return <Page eyebrow="Score" title="Reliability score" description="Compare the API-produced baseline and dynamic score with evidence and provenance. The browser never computes a score."><EmptyState title="Score not available" body="Submit a consented score request through the API before reviewing this result." /></Page>; }

export function BehaviorRoute() { return <Page eyebrow="Behavior" title="Behavior update" description="Inspect API-backed behavior observations and how a recorded update changes the simulation result. Updates require the behavior_updates purpose."><EmptyState title="Behavior data is unavailable" body="A valid behavior_updates consent receipt is required before observations can be processed." /></Page>; }

export function FairnessRoute() { return <Page eyebrow="Fairness" title="Synthetic parity diagnostic" description="Review cohort diagnostics and limitations for the fixed synthetic evaluation cohort. This is an evaluation surface, not an outcome decision."><EmptyState title="Fairness report is unavailable" body="The API has not returned a fairness report for this simulation." /></Page>; }

export function AuditRoute() { return <Page eyebrow="Audit" title="Audit trail" description="Trace consent, score, behavior, fairness, provenance, and validation events for this simulation."><EmptyState title="Audit events are unavailable" body="The API has not returned audit events for this simulation." /></Page>; }
