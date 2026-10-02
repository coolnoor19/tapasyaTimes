import Link from "next/link";
import { ArrowRight, CalendarRange, Check, Sparkles, Timer } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { siteConfig } from "@/config/site";
import { HeroSeatDemo } from "./hero-seat-demo";

const PROOF = [
  { icon: Check, text: "Live seat map" },
  { icon: Timer, text: "10-minute hold" },
  { icon: CalendarRange, text: "Up to 31 days at once" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* backdrop: soft blue wash and a faint dot grid */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(70rem_36rem_at_70%_-10%,var(--color-brand-100),transparent),radial-gradient(50rem_30rem_at_0%_30%,var(--color-leaf-50),transparent)]" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 opacity-[0.5] [background-image:radial-gradient(circle,var(--color-line-strong)_1px,transparent_1px)] [background-size:26px_26px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" />

      <Container className="grid items-center gap-14 py-14 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:py-28">
        <div className="flex flex-col items-start gap-6">
          <Reveal index={0}>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-surface px-3.5 py-1.5 text-[0.8125rem] font-semibold text-brand-800 shadow-sm">
              <Sparkles className="size-3.5 text-leaf-600" />
              Book by the hour, the day or the month
            </span>
          </Reveal>

          <Reveal index={1}>
            <h1 className="text-[2.5rem] font-extrabold leading-[1.08] text-ink sm:text-5xl lg:text-[3.5rem]">
              A calm, focused workspace you can{" "}
              <span className="bg-[linear-gradient(100deg,var(--color-brand-600),var(--color-leaf-600))] bg-clip-text text-transparent">reserve by the hour.</span>
            </h1>
          </Reveal>

          <Reveal index={2}>
            <p className="max-w-xl text-lg leading-relaxed text-muted">{siteConfig.description}</p>
          </Reveal>

          <Reveal index={3} className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/register">
                Create your account
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href="#seats">See seats &amp; prices</a>
            </Button>
          </Reveal>

          <Reveal index={4}>
            <ul className="flex flex-wrap gap-x-6 gap-y-2.5 pt-2">
              {PROOF.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2 text-sm font-medium text-muted">
                  <span className="grid size-5 place-items-center rounded-full bg-leaf-100 text-leaf-700">
                    <Icon className="size-3" strokeWidth={3} />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal index={3}>
          <HeroSeatDemo />
        </Reveal>
      </Container>
    </section>
  );
}
