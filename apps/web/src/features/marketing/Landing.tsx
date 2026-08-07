import { MarketingHeader } from './MarketingHeader.tsx';
import { Hero } from './Hero.tsx';
import { TrustStrip } from './TrustStrip.tsx';
import { HowItWorks } from './HowItWorks.tsx';
import { MethodologyProof } from './MethodologyProof.tsx';
import { SafetyDisclosure } from './SafetyDisclosure.tsx';
import { MarketingCTA } from './MarketingCTA.tsx';
import { MarketingFooter } from './MarketingFooter.tsx';

export function Landing() {
  return (
    <div className="min-h-screen overflow-hidden bg-bg text-ink">
      <div className="border-b border-border bg-surface px-5 py-2 text-center text-[11px] font-medium tracking-wide text-muted">
        Illustrative demo using synthetic data. No real lending decision is made.
      </div>
      <MarketingHeader />
      <main>
        <Hero />
        <TrustStrip />
        <HowItWorks />
        <MethodologyProof />
        <SafetyDisclosure />
        <MarketingCTA />
      </main>
      <MarketingFooter />
    </div>
  );
}
