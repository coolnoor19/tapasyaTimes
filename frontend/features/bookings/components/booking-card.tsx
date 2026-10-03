import Link from "next/link";
import { ArrowRight, Armchair, CalendarDays, Clock } from "lucide-react";
import { formatTimeRange } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { TIERS } from "@/features/landing/content";
import { bookingDaysText, formatCountdown, holdRemainingMs, type BookingPhase } from "../lib/booking-state";
import type { Booking } from "../types";
import { BookingStatusBadge } from "./booking-status-badge";

// One row of "My bookings": the whole card opens the booking.
export function BookingCard({ booking, phase, nowMs }: { booking: Booking; phase: BookingPhase; nowMs: number }) {
  const { seat, timeSlot } = booking;
  const dim = phase === "expired" || phase === "cancelled" || phase === "completed";

  return (
    <li>
      <Link
        href={`/bookings/${booking.id}`}
        className="group flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 shadow-card transition-[border-color,box-shadow] hover:border-brand-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className={dim ? "flex min-w-0 flex-col gap-3 opacity-80" : "flex min-w-0 flex-col gap-3"}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="tabular font-display text-base font-bold text-ink">{booking.bookingCode}</span>
            <BookingStatusBadge phase={phase} />
            {phase === "held" && <span className="tabular text-sm font-semibold text-warn-600">{formatCountdown(holdRemainingMs(booking, nowMs))} left</span>}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-muted">
            {seat && (
              <span className="inline-flex items-center gap-1.5">
                <Armchair className="size-4 text-subtle" aria-hidden="true" />
                Seat {seat.seatNumber} · {TIERS[seat.seatType].name} · Floor {seat.floor}
              </span>
            )}
            {timeSlot && (
              <span className="tabular inline-flex items-center gap-1.5">
                <Clock className="size-4 text-subtle" aria-hidden="true" />
                {formatTimeRange(timeSlot.startTime, timeSlot.endTime)}
              </span>
            )}
            <span className="tabular inline-flex items-center gap-1.5">
              <CalendarDays className="size-4 text-subtle" aria-hidden="true" />
              {bookingDaysText(booking)} ({booking.items.length} {booking.items.length === 1 ? "day" : "days"})
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <span className="tabular font-display text-lg font-extrabold text-ink">{formatRupees(booking.totalAmountPaise)}</span>
          <ArrowRight className="size-5 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" aria-hidden="true" />
        </div>
      </Link>
    </li>
  );
}
