import { useAuth, useClerk } from '@clerk/react';
import { Button } from '../ui/button.tsx';
import { Badge } from '../ui/badge.tsx';

export function Hero() {
  const { isSignedIn } = useAuth();
  const { openSignUp } = useClerk();

  return (
    <section id="hero" className="overflow-hidden border-b border-border bg-bg">
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 py-14 sm:px-8 md:grid-cols-[1.05fr_0.95fr] md:gap-10 md:py-20 lg:py-24">
        <div className="max-w-[600px]">
          <Badge tone="info" className="mb-6">Decision support, made visible</Badge>
          <h1 className="max-w-[12ch] text-4xl font-semibold leading-[1.06] tracking-[-0.04em] text-ink sm:text-5xl lg:text-[4.25rem]">
            See the evidence behind a changing underwriting picture.
          </h1>
          <p className="mt-6 max-w-[48ch] text-lg leading-8 text-muted">
            Explore how a reliability score responds to consented signals, with every contribution ready for human review.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {isSignedIn ? (
              <a href="/app"><Button size="lg">Open Workbench</Button></a>
            ) : (
              <Button size="lg" onClick={() => openSignUp()}>Start a Simulation</Button>
            )}
            <a className="px-2 py-3 text-sm font-medium text-ink underline decoration-border underline-offset-4 transition-colors hover:decoration-primary" href="#how-it-works">
              See how it works
            </a>
          </div>
        </div>

        <div className="relative min-h-[360px]" aria-label="Illustration of an evidence-led simulation result">
          <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
          <div className="relative ml-auto max-w-[440px] rounded-lg border border-border bg-surface p-5 shadow-[0_20px_60px_rgba(23,32,51,0.10)] sm:p-7">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Simulation result</p>
                <p className="mt-1 text-sm font-medium text-ink">A clear contribution ledger</p>
              </div>
              <span className="h-3 w-3 rounded-full bg-success" aria-label="stable result" />
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-5 border-b border-border py-6">
              <div>
                <p className="text-sm text-muted">Reliability score</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">Stable</p>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-[7px] border-primary/15 border-t-primary text-xs font-semibold text-primary">
                Band
              </div>
            </div>
            <ul className="space-y-4 pt-5 text-sm">
              <li className="flex items-start justify-between gap-4"><span className="text-muted">Traditional baseline</span><span className="font-medium text-ink">Included</span></li>
              <li className="flex items-start justify-between gap-4"><span className="text-muted">Consented signal</span><span className="font-medium text-success">Supports</span></li>
              <li className="flex items-start justify-between gap-4"><span className="text-muted">Manual review signal</span><span className="font-medium text-warning">Review</span></li>
            </ul>
            <p className="mt-6 border-t border-border pt-4 text-xs leading-5 text-muted">Evidence is structured first. The score is a simulation result, not an approval or denial.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
