import { useAuth, useClerk } from '@clerk/react';
import { Button } from '../../components/ui/button.tsx';

export function Hero() {
  const { isSignedIn } = useAuth();
  const { openSignUp } = useClerk();

  return (
    <section id="hero" className="border-b border-border bg-bg">
      <div className="mx-auto grid max-w-[1240px] items-center gap-16 px-5 py-16 sm:px-8 md:grid-cols-[0.92fr_1.08fr] md:gap-12 md:py-24 lg:px-10 lg:py-28">
        <div className="max-w-[620px]">
          <p className="mb-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <span className="h-px w-8 bg-primary" aria-hidden="true" />
            A clearer review surface
          </p>
          <h1 className="max-w-[10ch] text-[3.5rem] font-semibold leading-[0.98] tracking-[-0.065em] text-ink sm:text-6xl lg:text-[5.7rem]">
            Underwriting that sees the full picture.
          </h1>
          <p className="mt-7 max-w-[48ch] text-lg leading-8 text-muted sm:text-xl">
            Combine traditional application data with consented behavioral signals to create clearer, explainable risk reviews.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            {isSignedIn ? (
              <a href="/app"><Button size="lg">Open Workbench</Button></a>
            ) : (
              <Button size="lg" onClick={() => openSignUp()}>Explore the simulation</Button>
            )}
            <a className="px-1 py-3 text-sm font-medium text-ink underline decoration-border underline-offset-4 transition-colors hover:decoration-primary" href="#story">
              See the approach
            </a>
          </div>
        </div>

        <div className="relative min-h-[430px]" aria-label="Evidence path showing how a review is assembled">
          <div className="absolute inset-x-5 top-8 h-px bg-border md:inset-x-0" aria-hidden="true" />
          <div className="absolute bottom-5 left-5 top-8 w-px bg-border md:left-0" aria-hidden="true" />
          <div className="relative ml-auto max-w-[570px] border border-border bg-surface p-6 sm:p-8">
            <div className="flex items-start justify-between border-b border-border pb-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Review / 01</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-ink">A living evidence trail</h2>
              </div>
              <span className="font-mono text-xs text-muted">08.07.26</span>
            </div>
            <div className="relative mt-7 space-y-0 pl-7">
              <span className="absolute bottom-7 left-[5px] top-4 w-px bg-border" aria-hidden="true" />
              {[
                ['01', 'Application baseline', 'Income, history, stated purpose', 'Recorded'],
                ['02', 'Consented context', 'Cash-flow pattern / Purpose: review', 'Permissioned'],
                ['03', 'Behavior update', 'New observation changes the picture', 'Explained'],
              ].map(([number, title, description, label], index) => (
                <div key={number} className="relative pb-7 last:pb-0">
                  <span className={`absolute -left-7 top-1 flex h-3 w-3 items-center justify-center border ${index === 2 ? 'border-primary bg-primary' : 'border-ink bg-surface'}`} aria-hidden="true" />
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-ink">{title}</p>
                      <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
                    </div>
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">{label}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 border-t border-border pt-5 text-sm leading-6 text-muted">
              The review keeps the source, purpose, and change visible together.
            </div>
          </div>
          <p className="absolute bottom-0 right-0 max-w-[220px] text-right font-mono text-[10px] uppercase leading-5 tracking-[0.16em] text-muted">
            Evidence before inference
          </p>
        </div>
      </div>
    </section>
  );
}
