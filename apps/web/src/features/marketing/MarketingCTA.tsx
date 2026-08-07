import { useAuth, useClerk } from '@clerk/react';
import { Button } from '../../components/ui/button.tsx';

export function MarketingCTA() {
  const { isSignedIn } = useAuth();
  const { openSignIn, openSignUp } = useClerk();

  return (
    <section id="marketing-cta" className="bg-primary" aria-labelledby="cta-heading">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-5 py-16 sm:px-8 md:flex-row md:items-center md:justify-between md:py-20">
        <div className="max-w-[560px]">
          <h2 id="cta-heading" className="text-3xl font-semibold tracking-[-0.03em] text-primary-contrast sm:text-4xl">Run a Consented Simulation.</h2>
          <p className="mt-4 text-md leading-7 text-primary-contrast/80">Start with a synthetic applicant and keep every signal, contribution, and limitation in view.</p>
        </div>
        {isSignedIn ? (
          <a href="/app"><Button variant="secondary" size="lg">Open Workbench</Button></a>
        ) : (
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" size="lg" onClick={() => openSignUp()}>Start a Simulation</Button>
            <Button className="border-primary-contrast/40 text-primary-contrast hover:bg-primary-contrast/10" variant="outline" size="lg" onClick={() => openSignIn()}>Sign in</Button>
          </div>
        )}
      </div>
    </section>
  );
}
