import { Container } from "@/components/layout/container";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { STEPS } from "../content";
import { SectionHeading } from "./section-heading";

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-20 bg-surface py-20 sm:py-24">
      <Container>
        <SectionHeading id="how-title" eyebrow="How it works" title="From sign-up to your seat in three steps">
          No phone calls and no waiting. See what is free, pick it, and it is yours.
        </SectionHeading>

        <ol className="grid gap-6 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li key={title}>
              <ScrollReveal delay={index * 0.1} className="h-full">
                <div className="group relative h-full rounded-xl border border-line bg-canvas p-7 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-card">
                  <span className="absolute right-6 top-5 font-display text-5xl font-extrabold text-brand-100 transition-colors group-hover:text-brand-200" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className="mb-5 grid size-12 place-items-center rounded-xl bg-[linear-gradient(135deg,var(--color-brand-600),var(--color-leaf-600))] text-white shadow-md">
                    <Icon className="size-6" />
                  </span>
                  <h3 className="mb-2 text-xl font-bold text-ink">
                    <span className="sr-only">Step {index + 1}: </span>
                    {title}
                  </h3>
                  <p className="leading-relaxed text-muted">{text}</p>
                </div>
              </ScrollReveal>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
