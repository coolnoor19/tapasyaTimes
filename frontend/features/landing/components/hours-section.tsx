"use client";

import { Clock } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { formatTime } from "@/lib/dates";
import { useOverview } from "../api/use-overview";
import { SectionHeading } from "./section-heading";

export function HoursSection() {
  const { data, isPending } = useOverview();
  const slots = data?.timeSlots ?? [];

  return (
    <section id="hours" aria-labelledby="hours-title" className="scroll-mt-20 bg-surface py-20 sm:py-24">
      <Container>
        <SectionHeading id="hours-title" eyebrow="Hours" title="Book the time slot that suits you">
          Seats are booked in fixed slots, in Indian time. Pick one slot, then the days you need it.
        </SectionHeading>

        {isPending && (
          <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-3" aria-busy="true" aria-label="Loading hours">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-48 rounded-full" />
            ))}
          </div>
        )}

        {data && slots.length === 0 && <p className="text-center text-muted">Time slots will be announced very soon.</p>}

        {slots.length > 0 && (
          <ul className="mx-auto flex max-w-3xl flex-wrap justify-center gap-3">
            {slots.map((slot, index) => (
              <li key={slot.displayName}>
                <ScrollReveal delay={Math.min(index, 8) * 0.05} y={14}>
                  <span className="tabular inline-flex items-center gap-2.5 rounded-full border border-line bg-canvas px-5 py-3 text-[0.9375rem] font-semibold text-ink transition-[transform,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50">
                    <Clock className="size-4 text-brand-600" aria-hidden="true" />
                    {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                  </span>
                </ScrollReveal>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </section>
  );
}
