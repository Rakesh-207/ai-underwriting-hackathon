import type { ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { UserButton } from '@clerk/react';
import { Badge } from '../../components/ui/badge.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card.tsx';
import { SimulationBanner } from '../../components/SimulationBanner.tsx';
import { useSimulation } from './useSimulation.ts';
import type { SimulationSummary } from './types.ts';

const NAV = [
  ['overview', 'Overview', 'Simulation dashboard'],
  ['consent', 'Consent', 'Purpose-bound consent'],
  ['applicant', 'Applicant', 'Baseline application data'],
  ['score', 'Score', 'Baseline vs dynamic result'],
  ['behavior', 'Behavior', 'Behavior update'],
  ['fairness', 'Fairness', 'Synthetic parity diagnostic'],
  ['audit', 'Audit', 'Trail, provenance, limitations'],
] as const;

export function AppShell() {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-bg text-ink">
      <SimulationBanner />
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-contrast">
              <span className="text-sm font-semibold">UW</span>
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">Underwriting Simulation Workbench</p>
              <p className="text-xs text-muted">Synthetic demo · {location.pathname.split('/').pop()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone="neutral">Synthetic demo</Badge>
            <span className="hidden font-mono text-xs text-muted sm:inline">sim-synthetic-001</span>
            <UserButton />
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-6 md:flex-row sm:px-6">
        <nav aria-label="Workbench navigation" className="md:w-56 md:shrink-0">
          <ul className="flex gap-1 overflow-x-auto md:flex-col">
            {NAV.map(([path, label, description]) => (
              <li key={path} className="shrink-0">
                <NavLink
                  to={`/app/${path}`}
                  className={({ isActive }) => `block rounded-md px-3 py-2 text-sm ${isActive ? 'bg-primary/10 font-medium text-primary' : 'text-ink/80 hover:bg-surface'}`}
                >
                  <span className="block">{label}</span>
                  <span className="hidden text-xs text-muted md:block">{description}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <main className="min-w-0 flex-1"><Outlet /></main>
      </div>
    </div>
  );
}

export function SummaryPanel({ summary }: { summary: SimulationSummary }) {
  return (
    <Card className="mb-6">
      <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryItem label="Applicant ID" value={summary.applicantId} mono />
        <SummaryItem label="Reliability score" value={summary.reliabilityScore === null ? 'Not available' : String(summary.reliabilityScore)} />
        <SummaryItem label="Risk band" value={summary.riskBand ?? 'Not available'} />
        <SummaryItem label="Consent state" value={summary.consentState} />
        <SummaryItem label="Last updated" value={summary.lastUpdated ?? 'Not available'} />
      </CardContent>
    </Card>
  );
}

function SummaryItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><p className="text-xs uppercase tracking-wide text-muted">{label}</p><p className={`mt-1 text-sm font-medium ${mono ? 'font-mono' : ''}`}>{value}</p></div>;
}

export function Page({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  const data = useSimulation();
  return <><SummaryPanel summary={data.summary} /><div className="mb-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p></div>{data.error ? <EmptyState title="Data unavailable" body={data.error} /> : data.loading ? <LoadingState /> : children}</>;
}

export function LoadingState() { return <div role="status" className="rounded-lg border border-border bg-surface p-8 text-sm text-muted">Loading simulation data from the API…</div>; }
export function EmptyState({ title, body }: { title: string; body: string }) { return <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{body}</CardDescription></CardHeader></Card>; }
export function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) { return <Card><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-muted">{label}</p><p className="mt-3 text-2xl font-semibold">{value}</p><p className="mt-1 text-sm text-muted">{detail}</p></CardContent></Card>; }
