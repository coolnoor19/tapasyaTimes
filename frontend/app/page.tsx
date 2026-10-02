import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { HomeActions } from "@/features/auth/components/home-actions";
import { siteConfig } from "@/config/site";

// Placeholder. The real landing page is built in phase F2.
export default function HomePage() {
  const showDesign = process.env.NODE_ENV !== "production" || process.env.ENABLE_DESIGN_PAGE === "1";

  return (
    <main className="flex flex-1 items-center bg-[radial-gradient(60rem_30rem_at_50%_-10%,var(--color-brand-100),transparent)]">
      <Container className="flex flex-col items-center gap-6 py-24 text-center">
        <Logo className="animate-fade-up" />
        <h1 className="max-w-2xl animate-fade-up text-4xl font-bold text-ink [animation-delay:80ms] sm:text-5xl">
          {siteConfig.tagline}
        </h1>
        <p className="max-w-xl animate-fade-up text-muted [animation-delay:160ms]">Pick your dates, choose your seat, walk in ready to work.</p>
        <div className="animate-fade-up [animation-delay:240ms]">
          <HomeActions />
        </div>
        {showDesign && (
          <Button asChild variant="ghost" size="sm" className="animate-fade-up [animation-delay:320ms]">
            <Link href="/design">Open the style guide</Link>
          </Button>
        )}
      </Container>
    </main>
  );
}
