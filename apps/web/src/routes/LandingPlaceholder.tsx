import { useAuth, useClerk } from '@clerk/react';
import { Button } from '../components/ui/button.tsx';
import { Badge } from '../components/ui/badge.tsx';

// Public landing placeholder. The brief says: "The public / route shows a
// simple placeholder (NOT the full landing page)." The full trust-first B2B
// marketing page lands in a later phase (auth contract section 5).
export function LandingPlaceholder() {
  const { isSignedIn } = useAuth();
  const { openSignIn, openSignUp } = useClerk();

  return (
    <div className="min-h-screen bg-bg">
      {/* Minimal marketing header */}
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-contrast">
              <span className="text-sm font-semibold">UW</span>
            </div>
            <span className="text-md font-semibold text-ink">
              Underwriting Simulation
            </span>
          </div>
          {!isSignedIn && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => openSignIn()}>
                Sign in
              </Button>
              <Button size="sm" onClick={() => openSignUp()}>
                Get started
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Hero placeholder */}
      <main className="mx-auto max-w-[1200px] px-6 py-16 md:py-24">
        <div className="max-w-2xl">
          <Badge tone="primary" className="mb-5">
            Foundation phase
          </Badge>
          <h1 className="text-2xl md:text-[2.5rem] font-semibold leading-tight tracking-tight text-ink">
            Explore how consented alternative signals can complement a
            traditional application baseline.
          </h1>
          <p className="mt-5 text-lg text-muted">
            A simulation tool for underwriting teams — deterministic scoring,
            evidence-backed explanations, and a transparent audit trail. The
            full marketing experience arrives in the next phase.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {isSignedIn ? (
              <a href="/app">
                <Button size="lg">Open workbench</Button>
              </a>
            ) : (
              <>
                <Button size="lg" onClick={() => openSignUp()}>
                  Start a simulation
                </Button>
                <Button size="lg" variant="outline" onClick={() => openSignIn()}>
                  Sign in
                </Button>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
