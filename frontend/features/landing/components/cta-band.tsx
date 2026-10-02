import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/layout/container";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

export function CtaBand() {
  return (
    <section aria-labelledby="cta-title" className="pb-20 sm:pb-24">
      <Container>
        <ScrollReveal>
          <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,var(--color-brand-900),var(--color-brand-700)_55%,var(--color-leaf-700))] px-6 py-14 text-center text-white shadow-pop sm:px-12 sm:py-16">
            <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-16 size-64 rounded-full bg-brand-400/30 blur-3xl" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-10 size-72 rounded-full bg-leaf-400/25 blur-3xl" />
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle,#fff_1px,transparent_1px)] [background-size:22px_22px]" />

            <div className="relative mx-auto max-w-xl">
              <h2 id="cta-title" className="text-3xl font-bold sm:text-4xl">
                Ready to claim your seat?
              </h2>
              <p className="mt-4 text-lg text-white/80">Create your account in a minute and see what is free today.</p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/register"
                  className="group inline-flex h-13 items-center gap-2 rounded-md bg-white px-7 text-base font-semibold text-brand-800 shadow-md transition-[transform,box-shadow] duration-150 hover:shadow-pop active:scale-[0.97]"
                >
                  Create your account
                  <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-13 items-center rounded-md border border-white/40 px-7 text-base font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-white/10 active:scale-[0.97]"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </Container>
    </section>
  );
}
