import { MarketingHeader } from '../components/marketing/MarketingHeader.tsx';
import { Hero } from '../components/marketing/Hero.tsx';
import { TrustStrip } from '../components/marketing/TrustStrip.tsx';
import { HowItWorks } from '../components/marketing/HowItWorks.tsx';
import { MethodologyProof } from '../components/marketing/MethodologyProof.tsx';
import { SafetyDisclosure } from '../components/marketing/SafetyDisclosure.tsx';
import { MarketingCTA } from '../components/marketing/MarketingCTA.tsx';
import { MarketingFooter } from '../components/marketing/MarketingFooter.tsx';

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
