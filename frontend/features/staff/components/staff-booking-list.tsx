"use client";

import Link from "next/link";
import { Armchair, CalendarDays, Clock, Phone } from "lucide-react";
import { BookingStatusBadge } from "@/features/bookings/components/booking-status-badge";
import { bookingDaysText, bookingPhase, formatCountdown, holdRemainingMs } from "@/features/bookings/lib/booking-state";
import { TIERS } from "@/features/landing/content";
import { todayInIndia, formatTimeRange } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { fullName } from "../lib/board-math";
import type { StaffBooking } from "../types";

// Bookings for staff: a table on wide screens, stacked cards on phones. Each row links to the booking; the customer's
// name links to the customer. `nowMs` is the server's clock, so an unpaid hold shows "Hold expired" the moment it ends.
export function StaffBookingList({ bookings, nowMs, hideCustomer = false, dimmed = false }: { bookings: StaffBooking[]; nowMs: number; hideCustomer?: boolean; dimmed?: boolean }) {
  const today = todayInIndia(new Date(nowMs));
  const rows = bookings.map((booking) => ({ booking, phase: bookingPhase(booking, nowMs, today) }));

  return (
    <div className={dimmed ? "opacity-60 transition-opacity" : "transition-opacity"}>
      {/* wide screens */}
      <div className="hidden overflow-hidden rounded-lg border border-line bg-surface shadow-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-canvas/60 text-xs uppercase tracking-wide text-subtle">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Booking</th>
              {!hideCustomer && <th scope="col" className="px-4 py-3 font-semibold">Customer</th>}
              <th scope="col" className="px-4 py-3 font-semibold">Seat and slot</th>
              <th scope="col" className="px-4 py-3 font-semibold">Days</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Total</th>
              <th scope="col" className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ booking, phase }) => (
              <tr key={booking.id} className="transition-colors hover:bg-brand-50/40">
                <td className="px-4 py-3.5">
                  <Link href={`/manager/bookings/${booking.id}`} className="tabular font-semibold text-brand-700 hover:text-brand-800 hover:underline">
                    {booking.bookingCode}
                  </Link>
                </td>
                {!hideCustomer && (
                  <td className="max-w-56 px-4 py-3.5">
                    <Link href={`/manager/customers/${booking.customer.id}`} className="block truncate font-medium text-ink hover:underline">
                      {fullName(booking.customer)}
                    </Link>
                    <span className="tabular block truncate text-xs text-subtle">{booking.customer.phone}</span>
                  </td>
                )}
                <td className="px-4 py-3.5 text-muted">
                  <span className="block text-ink">
                    {booking.seat ? `${booking.seat.seatNumber} · ${TIERS[booking.seat.seatType].name}` : "—"}
                  </span>
                  <span className="tabular text-xs">{booking.timeSlot ? formatTimeRange(booking.timeSlot.startTime, booking.timeSlot.endTime) : ""}</span>
                </td>
                <td className="tabular px-4 py-3.5 text-muted">
                  <span className="block text-ink">{bookingDaysText(booking)}</span>
                  <span className="text-xs">{booking.items.length} {booking.items.length === 1 ? "day" : "days"}</span>
                </td>
                <td className="tabular px-4 py-3.5 text-right font-semibold text-ink">{formatRupees(booking.totalAmountPaise)}</td>
                <td className="px-4 py-3.5">
                  <span className="flex flex-col items-start gap-1">
                    <BookingStatusBadge phase={phase} />
                    {phase === "held" && <span className="tabular text-xs text-warn-600">{formatCountdown(holdRemainingMs(booking, nowMs))} left</span>}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* phones */}
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map(({ booking, phase }) => (
          <li key={booking.id} className="rounded-lg border border-line bg-surface p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/manager/bookings/${booking.id}`} className="tabular font-display font-bold text-brand-700">
                {booking.bookingCode}
              </Link>
              <span className="flex items-center gap-2">
                {phase === "held" && <span className="tabular text-xs font-semibold text-warn-600">{formatCountdown(holdRemainingMs(booking, nowMs))} left</span>}
                <BookingStatusBadge phase={phase} />
              </span>
            </div>
            {!hideCustomer && (
              <p className="mt-2 flex items-center gap-2 text-sm">
                <Link href={`/manager/customers/${booking.customer.id}`} className="min-w-0 truncate font-medium text-ink">
                  {fullName(booking.customer)}
                </Link>
                <span className="tabular flex shrink-0 items-center gap-1 text-xs text-subtle">
                  <Phone className="size-3" aria-hidden="true" />
                  {booking.customer.phone}
                </span>
              </p>
            )}
            <div className="mt-2 flex flex-col gap-1 text-sm text-muted">
              {booking.seat && (
                <span className="flex items-center gap-1.5">
                  <Armchair className="size-4 text-subtle" aria-hidden="true" />
                  Seat {booking.seat.seatNumber} · {TIERS[booking.seat.seatType].name}
                </span>
              )}
              {booking.timeSlot && (
                <span className="tabular flex items-center gap-1.5">
                  <Clock className="size-4 text-subtle" aria-hidden="true" />
                  {formatTimeRange(booking.timeSlot.startTime, booking.timeSlot.endTime)}
                </span>
              )}
              <span className="tabular flex items-center gap-1.5">
                <CalendarDays className="size-4 text-subtle" aria-hidden="true" />
                {bookingDaysText(booking)} ({booking.items.length})
              </span>
            </div>
            <p className="tabular mt-3 text-right font-display text-lg font-extrabold text-ink">{formatRupees(booking.totalAmountPaise)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
