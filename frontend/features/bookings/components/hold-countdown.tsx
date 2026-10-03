"use client";

import { Timer } from "lucide-react";
import { cn } from "@/lib/cn";
import { describeCountdown, formatCountdown, holdRemainingMs } from "../lib/booking-state";
import type { Booking } from "../types";

const FALLBACK_HOLD_MS = 10 * 60_000;
const URGENT_MS = 2 * 60_000;

// The time left on an unpaid hold: a big mm:ss and a bar that drains. Turns amber-red in the last two minutes.
// Screen readers get the words ("9 minutes 42 seconds") once a minute, not a new number every second.
export function HoldCountdown({ booking, nowMs, className }: { booking: Pick<Booking, "expiresAt" | "createdAt">; nowMs: number; className?: string }) {
  const remaining = holdRemainingMs(booking, nowMs);
  const total = booking.expiresAt ? Date.parse(booking.expiresAt) - Date.parse(booking.createdAt) : FALLBACK_HOLD_MS;
  const share = total > 0 ? Math.min(1, remaining / total) : 0;
  const urgent = remaining <= URGENT_MS;
  const minutesLeft = Math.ceil(remaining / 60_000);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-3">
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", urgent ? "bg-danger-50 text-danger-600" : "bg-warn-50 text-warn-600")}>
          <Timer className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-subtle">Seat held for you</p>
          <p role="timer" aria-hidden="true" className={cn("tabular font-display text-3xl font-extrabold leading-none", urgent ? "text-danger-600" : "text-ink")}>
            {formatCountdown(remaining)}
          </p>
          <span className="sr-only" aria-live="polite">
            {`About ${minutesLeft} ${minutesLeft === 1 ? "minute" : "minutes"} left on your hold`}
          </span>
          <span className="sr-only">{describeCountdown(remaining)} remaining</span>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className={cn("h-full rounded-full transition-[width] duration-1000 ease-linear", urgent ? "bg-danger-600" : "bg-warn-600")} style={{ width: `${share * 100}%` }} />
      </div>
    </div>
  );
}
