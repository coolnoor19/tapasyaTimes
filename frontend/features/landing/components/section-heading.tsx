import type { ReactNode } from "react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

// The small label, big title and one-line intro that open every landing section.
export function SectionHeading({ eyebrow, title, children, id }: { eyebrow: string; title: string; children?: ReactNode; id: string }) {
  return (
    <ScrollReveal className="mx-auto mb-12 max-w-2xl text-center">
      <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-leaf-700">{eyebrow}</p>
      <h2 id={id} className="text-3xl font-bold text-ink sm:text-4xl">
        {title}
      </h2>
      {children && <p className="mt-4 text-[1.0625rem] leading-relaxed text-muted">{children}</p>}
    </ScrollReveal>
  );
}
