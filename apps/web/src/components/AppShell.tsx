import type { ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { UserButton } from '@clerk/react';
import { Badge } from './ui/badge.tsx';
import { SimulationBanner } from './SimulationBanner.tsx';

// Navigation order is fixed by the contract:
// Overview | Consent | Applicant | Score | Behavior | Fairness | Audit
// (companion spec 3.1, auth contract 6)
const NAV_ITEMS: Array<{ to: string; label: string; description: string }> = [
  { to: '/app/overview', label: 'Overview', description: 'Simulation dashboard' },
  { to: '/app/consent', label: 'Consent', description: 'Purpose-bound consent' },
  { to: '/app/applicant', label: 'Applicant', description: 'Baseline application data' },
  { to: '/app/score', label: 'Score', description: 'Baseline vs dynamic result' },
  { to: '/app/behavior', label: 'Behavior', description: 'Behavior update' },
  { to: '/app/fairness', label: 'Fairness', description: 'Synthetic parity diagnostic' },
  { to: '/app/audit', label: 'Audit', description: 'Trail, provenance, limitations' },
];

export function AppShell({ children }: { children?: ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <SimulationBanner />

      {/* Header */}
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-contrast">
              <span className="text-sm font-semibold">UW</span>
            </div>
            <div>
              <h1 className="text-md font-semibold text-ink leading-tight">
                Underwriting Simulation Workbench
              </h1>
              <p className="text-xs text-muted leading-tight">
                Lender-side decision-support simulation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone="neutral" className="hidden sm:inline-flex">
              Synthetic demo
            </Badge>
            <UserButton />
          </div>
        </div>
      </header>

      {/* Body: left nav + main content */}
      <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-6 py-6 md:flex-row">
        {/* Left navigation */}
        <nav aria-label="Workbench navigation" className="md:w-60 md:shrink-0">
          <ul className="flex gap-1 overflow-x-auto pb-2 md:flex-col md:overflow-visible md:pb-0">
            {NAV_ITEMS.map((item) => {
              const active = location.pathname === item.to;
              return (
                <li key={item.to} className="shrink-0 md:shrink">
                  <NavLink
                    to={item.to}
                    className={[
                      'block rounded-md px-3 py-2 text-sm transition-colors',
                      active
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-ink/80 hover:bg-bg hover:text-ink',
                    ].join(' ')}
                  >
                    <span className="block">{item.label}</span>
                    <span className="hidden text-xs text-muted md:block">
                      {item.description}
                    </span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Main content */}
        <main className="min-w-0 flex-1">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
