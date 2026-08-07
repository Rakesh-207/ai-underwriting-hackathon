import { useAuth, useClerk } from '@clerk/react';
import { Button } from '../../components/ui/button.tsx';

export function MarketingCTA() {
  const { isSignedIn } = useAuth();
  const { openSignIn, openSignUp } = useClerk();

  return (
    <section id="marketing-cta" className="bg-primary" aria-labelledby="cta-heading">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-8 px-5 py-16 sm:px-8 md:flex-row md:items-center md:justify-between md:py-24 lg:px-10">
        <div className="max-w-[560px]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-contrast/70">A useful place to start</p>
          <h2 id="cta-heading" className="mt-4 text-4xl font-semibold leading-[1.05] tracking-[-0.05em] text-primary-contrast sm:text-5xl">Bring the evidence together.</h2>
          <p className="mt-4 text-md leading-7 text-primary-contrast/80">Explore the synthetic review flow and see how a change can remain understandable from source to explanation.</p>
        </div>
        {isSignedIn ? (
          <a href="/app"><Button variant="secondary" size="lg">Open Workbench</Button></a>
        ) : (
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" size="lg" onClick={() => openSignUp()}>Explore the simulation</Button>
            <Button className="border-primary-contrast/40 text-primary-contrast hover:bg-primary-contrast/10" variant="outline" size="lg" onClick={() => openSignIn()}>Sign in</Button>
          </div>
        )}
      </div>
    </section>
  );
}
