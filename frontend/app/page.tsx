import { CtaBand } from "@/features/landing/components/cta-band";
import { FaqSection } from "@/features/landing/components/faq-section";
import { Hero } from "@/features/landing/components/hero";
import { HoursSection } from "@/features/landing/components/hours-section";
import { HowItWorks } from "@/features/landing/components/how-it-works";
import { LandingFooter } from "@/features/landing/components/landing-footer";
import { LandingHeader } from "@/features/landing/components/landing-header";
import { TiersSection } from "@/features/landing/components/tiers-section";

// The public face of Tapasya Times. Prices, seat counts and hours inside it are live (see features/landing).
export default function HomePage() {
  return (
    <>
      <LandingHeader />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <TiersSection />
        <HoursSection />
        <FaqSection />
        <CtaBand />
      </main>
      <LandingFooter />
    </>
  );
}
