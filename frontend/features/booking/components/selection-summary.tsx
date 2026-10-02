"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CalendarCheck, CircleAlert, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { formatDateList, formatTimeRange } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import type { TimeSlot } from "../types";

export type SummaryStatus = "checking" | "error" | "blocked" | "ready";

interface SelectionSummaryProps {
  visible: boolean;
  slot: TimeSlot | null;
  dates: string[];
  status: SummaryStatus;
  // seats free on every chosen day
  freeSeatCount: number;
  priceRange: { min: number; max: number } | null;
  // why Continue is disabled, when status is "blocked"
  blockedReason: string;
  onContinue: () => void;
  onRetry: () => void;
}

// The bar that slides up from the bottom once there is a selection: what was chosen, whether it can be booked,
// and the way forward. It never covers content: the page keeps padding for it.
export function SelectionSummary({ visible, slot, dates, status, freeSeatCount, priceRange, blockedReason, onContinue, onRetry }: SelectionSummaryProps) {
  return (
    <AnimatePresence>
      {visible && slot && (
        <motion.aside
          aria-label="Your selection"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 shadow-[0_-8px_30px_rgb(14_28_56/0.08)] backdrop-blur-md"
        >
          <Container className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:py-4">
            <div className="flex min-w-0 items-center gap-3.5">
              <span className="hidden size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 sm:grid">
                <CalendarCheck className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-base font-bold text-ink" aria-live="polite">
                  <AnimatedNumber value={dates.length} className="tabular" /> {dates.length === 1 ? "day" : "days"}
                  <span className="font-normal text-muted"> · {formatDateList(dates)}</span>
                </p>
                <p className="tabular truncate text-sm text-muted">
                  {formatTimeRange(slot.startTime, slot.endTime)}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <div className="min-h-5 text-sm sm:text-right" aria-live="polite">
                {status === "checking" && (
                  <span className="inline-flex items-center gap-2 text-muted">
                    <Spinner className="size-3.5" label="Checking seats" /> Checking seats…
                  </span>
                )}
                {status === "error" && (
                  <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 font-semibold text-danger-700 hover:underline">
                    <RotateCw className="size-3.5" /> Couldn’t check seats. Try again
                  </button>
                )}
                {status === "blocked" && (
                  <span className="inline-flex items-center gap-1.5 font-medium text-danger-700">
                    <CircleAlert className="size-4 shrink-0" /> {blockedReason}
                  </span>
                )}
                {status === "ready" && (
                  <span className="text-ink">
                    <strong className="font-semibold text-leaf-700">
                      {freeSeatCount} {freeSeatCount === 1 ? "seat" : "seats"}
                    </strong>{" "}
                    free on every day
                    {priceRange && (
                      <span className="tabular text-muted sm:block">
                        <span className="sm:hidden"> · </span>
                        {priceRange.min === priceRange.max ? (
                          <>
                            <AnimatedNumber value={priceRange.min} format={formatRupees} /> per day
                          </>
                        ) : (
                          <>
                            from <AnimatedNumber value={priceRange.min} format={formatRupees} /> per day
                          </>
                        )}
                      </span>
                    )}
                  </span>
                )}
              </div>

              <Button size="lg" variant="accent" onClick={onContinue} disabled={status !== "ready"} className={cn("w-full sm:w-auto", status === "ready" && "animate-pop")}>
                Choose your seat
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </Container>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
