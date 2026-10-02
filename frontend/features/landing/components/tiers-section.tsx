"use client";

import Link from "next/link";
import { ArrowRight, Armchair } from "lucide-react";
import { motion } from "motion/react";
import { Container } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { cn } from "@/lib/cn";
import { formatRupees } from "@/lib/money";
import { useOverview } from "../api/use-overview";
import { TIERS, TIER_ORDER } from "../content";
import { SectionHeading } from "./section-heading";

export function TiersSection() {
  const { data, isPending, isError } = useOverview();

  // A tier with no in-service seats is not on offer, so it is not shown. While loading we show all three as placeholders.
  const tiers = TIER_ORDER.map((type) => data?.tiers.find((tier) => tier.seatType === type)).filter((tier) => !data || (tier && tier.seatCount > 0));

  return (
    <section id="seats" aria-labelledby="seats-title" className="scroll-mt-20 py-20 sm:py-24">
      <Container>
        <SectionHeading id="seats-title" eyebrow="Seats & prices" title="Seats for the way you work">
          Every price is per hour and always up to date. You pay for the hours of the time slot you book, for each day.
        </SectionHeading>

        {isPending && (
          <div className="grid gap-6 md:grid-cols-3" aria-busy="true" aria-label="Loading prices">
            {TIER_ORDER.map((type) => (
              <div key={type} className="rounded-xl border border-line bg-surface p-7">
                <Skeleton className="mb-5 size-11 rounded-xl" />
                <Skeleton className="mb-3 h-6 w-1/2" />
                <Skeleton className="mb-6 h-4 w-full" />
                <Skeleton className="h-10 w-2/5" />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <p role="alert" className="mx-auto max-w-md rounded-lg border border-line bg-surface p-6 text-center text-muted">
            We couldn’t load the latest prices just now. Please refresh the page in a moment.
          </p>
        )}

        {data && tiers.length === 0 && <p className="text-center text-muted">Seats will be available very soon.</p>}

        {data && tiers.length > 0 && (
          <div className={cn("grid gap-6", tiers.length >= 3 ? "md:grid-cols-3" : tiers.length === 2 ? "md:grid-cols-2 md:mx-auto md:max-w-3xl" : "mx-auto max-w-sm")}>
            {tiers.map((tier, index) => {
              if (!tier) return null;
              const look = TIERS[tier.seatType];
              return (
                <ScrollReveal key={tier.seatType} delay={index * 0.1} className="h-full">
                  <motion.article
                    whileHover={{ y: -6 }}
                    transition={{ type: "spring", stiffness: 320, damping: 22 }}
                    className={cn("flex h-full flex-col rounded-xl border-2 bg-surface p-7 shadow-card transition-colors duration-300", look.border)}
                  >
                    <span className={cn("mb-5 grid size-11 place-items-center rounded-xl", look.soft, look.accent)}>
                      <Armchair className="size-6" />
                    </span>
                    <h3 className="text-xl font-bold text-ink">{look.name}</h3>
                    <p className={cn("mb-3 text-sm font-semibold", look.accent)}>{look.tagline}</p>
                    <p className="mb-6 flex-1 leading-relaxed text-muted">{look.description}</p>

                    <div className="mb-5 flex items-end gap-1.5 border-t border-line pt-5">
                      {tier.pricePerHourPaise === null ? (
                        <span className="text-lg font-semibold text-muted">Price coming soon</span>
                      ) : (
                        <>
                          <span className="tabular font-display text-4xl font-extrabold text-ink">{formatRupees(tier.pricePerHourPaise)}</span>
                          <span className="pb-1.5 text-sm font-medium text-muted">/ hour</span>
                        </>
                      )}
                    </div>

                    <p className="mb-5 flex items-center gap-2 text-sm text-muted">
                      <span className={cn("size-2 rounded-full", look.dot)} aria-hidden="true" />
                      {tier.seatCount} {tier.seatCount === 1 ? "seat" : "seats"} available to book
                    </p>

                    <Link href="/register" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800">
                      Book a {look.name} seat
                      <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
                    </Link>
                  </motion.article>
                </ScrollReveal>
              );
            })}
          </div>
        )}
      </Container>
    </section>
  );
}
