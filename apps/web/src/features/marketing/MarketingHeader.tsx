import { useAuth, useClerk } from '@clerk/react';
import { Button } from '../../components/ui/button.tsx';

export function MarketingHeader() {
  const { isSignedIn } = useAuth();
  const { openSignIn, openSignUp } = useClerk();

  return (
    <header className="border-b border-border/80 bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between px-5 sm:px-8">
        <a href="/" className="flex items-center gap-3" aria-label="Underwriting Simulation home">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-contrast shadow-sm">
            U
          </span>
          <span className="text-sm font-semibold tracking-tight text-ink sm:text-md">
            Underwriting Simulation
          </span>
        </a>

        <nav className="hidden items-center gap-6 text-sm text-muted md:flex" aria-label="Main navigation">
          <a className="transition-colors hover:text-ink" href="#methodology">Methodology</a>
          <a className="transition-colors hover:text-ink" href="#safety">Safety</a>
          <a className="transition-colors hover:text-ink" href="#how-it-works">How it works</a>
        </nav>

        <div className="flex items-center gap-2">
          {!isSignedIn && (
            <Button variant="ghost" size="sm" onClick={() => openSignIn()}>
              Sign in
            </Button>
          )}
          {isSignedIn ? (
            <a href="/app">
              <Button size="sm">Open Workbench</Button>
            </a>
          ) : (
            <Button size="sm" onClick={() => openSignUp()}>
              Get started
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
