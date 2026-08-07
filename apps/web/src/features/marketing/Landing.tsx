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
    <div className="min-h-screen bg-bg">
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
