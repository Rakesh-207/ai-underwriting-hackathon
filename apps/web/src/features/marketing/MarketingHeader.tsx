import { useAuth, useClerk } from '@clerk/react';
import { Button } from '../../components/ui/button.tsx';

export function MarketingHeader() {
  const { isSignedIn } = useAuth();
  const { openSignIn, openSignUp } = useClerk();

  return (
    <header className="border-b border-border bg-bg">
      <div className="mx-auto flex h-[78px] max-w-[1240px] items-center justify-between px-5 sm:px-8 lg:px-10">
        <a href="/" className="flex items-center gap-3" aria-label="Underwriting Simulation home">
          <span className="relative flex h-9 w-9 items-center justify-center border border-ink text-sm font-semibold text-ink">
            <span className="absolute -bottom-1 -right-1 h-2 w-2 bg-primary" aria-hidden="true" />
            U
          </span>
          <span className="text-sm font-semibold tracking-tight text-ink sm:text-md">
            Underwriting / Simulation
          </span>
        </a>

        <nav className="hidden items-center gap-8 text-sm text-muted md:flex" aria-label="Main navigation">
          <a className="transition-colors hover:text-ink" href="#story">The approach</a>
          <a className="transition-colors hover:text-ink" href="#methodology">Explainability</a>
          <a className="transition-colors hover:text-ink" href="#safety">Trust</a>
        </nav>

        <div className="flex items-center gap-2">
          {!isSignedIn && (
            <Button className="hidden sm:inline-flex" variant="ghost" size="sm" onClick={() => openSignIn()}>
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
