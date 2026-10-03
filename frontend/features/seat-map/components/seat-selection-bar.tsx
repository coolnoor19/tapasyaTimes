"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Armchair, X } from "lucide-react";
import { Container } from "@/components/layout/container";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Button } from "@/components/ui/button";
import { TIERS } from "@/features/landing/content";
import { formatRupees } from "@/lib/money";
import type { MapSeat } from "../lib/seat-map";

interface SeatSelectionBarProps {
  seat: MapSeat | null;
  daysChosen: number;
  onContinue: () => void;
  onClear: () => void;
  // warm the next screen when the person reaches for the button
  onIntent: () => void;
}

// The bar that slides up once a seat is chosen: which seat, what it costs for the chosen days, and the way on.
// The total is always price-per-day x days, the same sum the backend makes when it creates the booking.
export function SeatSelectionBar({ seat, daysChosen, onContinue, onClear, onIntent }: SeatSelectionBarProps) {
  const perDay = seat?.pricePerDayPaise ?? null;

  return (
    <AnimatePresence>
      {seat && (
        <motion.aside
          aria-label="Your seat"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 shadow-[0_-8px_30px_rgb(14_28_56/0.08)] backdrop-blur-md"
        >
          <Container className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:py-4">
            <div className="flex min-w-0 items-center gap-3.5">
              <span className="hidden size-11 shrink-0 place-items-center rounded-xl bg-leaf-50 text-leaf-700 sm:grid">
                <Armchair className="size-5" />
              </span>
              <div className="min-w-0" aria-live="polite">
                <p className="truncate font-display text-base font-bold text-ink">
                  Seat {seat.seatNumber} <span className="font-normal text-muted">· {TIERS[seat.tier].name} · Floor {seat.floor}</span>
                </p>
                <p className="tabular truncate text-sm text-muted">
                  {perDay === null ? (
                    "Price shown at checkout"
                  ) : (
                    <>
                      {formatRupees(perDay)} × {daysChosen} {daysChosen === 1 ? "day" : "days"}
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-5">
              {perDay !== null && (
                <p className="tabular mr-auto font-display text-xl font-extrabold text-ink sm:mr-0">
                  <AnimatedNumber value={perDay * daysChosen} format={formatRupees} />
                </p>
              )}
              <button
                type="button"
                onClick={onClear}
                aria-label="Clear my seat"
                className="grid size-10 shrink-0 place-items-center rounded-md text-subtle transition-colors hover:bg-danger-50 hover:text-danger-700 focus-visible:outline-none focus-visible:shadow-ring active:scale-90"
              >
                <X className="size-5" />
              </button>
              <Button size="lg" variant="accent" onClick={onContinue} onPointerEnter={onIntent} onFocus={onIntent} className="animate-pop">
                Continue
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </Container>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
