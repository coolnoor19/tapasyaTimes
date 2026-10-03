"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Armchair, CalendarDays, Clock, CreditCard } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/lib/api/client";
import { formatDateList, formatDay, formatDayWithYear, formatTime, formatTimeRange, nowInIndia, todayInIndia } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { AVAILABILITY_PREFIX } from "@/features/booking/api/booking-api";
import { selectionQuery } from "@/features/booking/lib/selection";
import { TIERS } from "@/features/landing/content";
import { useBooking } from "../hooks/use-bookings";
import { useServerNow } from "../hooks/use-server-now";
import { bookingDays, bookingPhase, holdMinutes, type BookingPhase } from "../lib/booking-state";
import type { Booking } from "../types";
import { BookingStatusBadge } from "./booking-status-badge";
import { HoldCountdown } from "./hold-countdown";

// One booking: its code, status, seat, slot and every day with its price. While the seat is held it leads with the
// countdown. The time is the SERVER's, and "expired" is worked out here (the backend leaves the booking PENDING).
export function BookingDetail({ id }: { id: string }) {
  const query = useBooking(id);
  const queryClient = useQueryClient();
  const nowMs = useServerNow();
  const booking = query.data;
  const phase = booking ? bookingPhase(booking, nowMs, todayInIndia(new Date(nowMs))) : null;

  // The moment a hold runs out the seat is free again: tell every seat map to look again.
  const holdEnded = phase === "expired" && booking?.status === "PENDING";
  useEffect(() => {
    if (holdEnded) void queryClient.invalidateQueries({ queryKey: AVAILABILITY_PREFIX });
  }, [holdEnded, queryClient]);

  const notFound = query.isError && isApiError(query.error) && (query.error.status === 404 || query.error.status === 400); // 400: the id in the address is not even an id

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={booking ? `Booking ${booking.bookingCode}` : "Booking"}
        description={booking ? `Made on ${formatMadeOn(booking.createdAt)}` : undefined}
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/bookings">
              <ArrowLeft className="size-4" />
              My bookings
            </Link>
          </Button>
        }
      />

      {notFound && (
        <Alert tone="warn" title="We can’t find that booking" action={<Button asChild size="sm" variant="secondary"><Link href="/bookings">See my bookings</Link></Button>}>
          It may belong to another account, or the link is wrong.
        </Alert>
      )}

      {query.isError && !notFound && !booking && (
        <Alert
          tone="danger"
          title="We couldn’t load this booking"
          action={
            <Button size="sm" variant="secondary" loading={query.isFetching} onClick={() => query.refetch()}>
              Try again
            </Button>
          }
        >
          {isApiError(query.error) && query.error.isNetworkError ? "Check your connection and try again." : "Please try again in a moment."}
        </Alert>
      )}

      {query.isPending && !booking && !query.isError && (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      )}

      {booking && phase && (
        <>
          <StatusPanel booking={booking} phase={phase} nowMs={nowMs} />
          <Details booking={booking} phase={phase} />
        </>
      )}
    </div>
  );
}

function StatusPanel({ booking, phase, nowMs }: { booking: Booking; phase: BookingPhase; nowMs: number }) {
  const again = booking.timeSlot ? `/book?${selectionQuery(booking.timeSlot.id, bookingDays(booking))}` : "/book";

  if (phase === "held") {
    return (
      <Card className="animate-fade-up border-warn-600/25">
        <CardContent className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="flex flex-col gap-5">
            <HoldCountdown booking={booking} nowMs={nowMs} />
            <p className="max-w-xl text-sm leading-relaxed text-muted">
              Nobody else can book this seat on your days while it is held. If the timer reaches zero, the seat goes back to everyone.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            {/* Payments are connected in a later step: the button is here so the screen shows where payment will happen. */}
            <Button size="lg" disabled aria-describedby="pay-note">
              <CreditCard className="size-5" />
              Pay {formatRupees(booking.totalAmountPaise)}
            </Button>
            <p id="pay-note" className="max-w-56 text-xs text-subtle sm:text-right">
              Online payment isn’t switched on yet, so this booking can’t be completed today.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === "expired") {
    return (
      <Alert tone="warn" title="This hold has ended" action={<Button asChild size="sm" variant="secondary"><Link href={again}>Choose a seat again</Link></Button>}>
        The {holdMinutes(booking)} minutes ran out before the booking was paid, so the seat was released for others.
      </Alert>
    );
  }
  if (phase === "confirmed") return <Alert tone="success" title="Your seat is confirmed">See you there. Show your booking code if you are asked.</Alert>;
  if (phase === "completed") return <Alert tone="info" title="This booking is complete" />;
  return <Alert tone="danger" title="This booking was cancelled" />;
}

function Details({ booking, phase }: { booking: Booking; phase: BookingPhase }) {
  const { seat, timeSlot, items } = booking;
  return (
    <Card className="animate-fade-up">
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <BookingStatusBadge phase={phase} />
          <span className="tabular text-sm text-muted">{booking.bookingCode}</span>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          {seat && (
            <Fact icon={<Armchair className="size-5" />} label="Seat">
              <span>
                {seat.seatNumber} <span className="font-normal text-muted">· Floor {seat.floor}</span>
              </span>
              <Badge tone={seat.seatType === "EXECUTIVE" ? "executive" : seat.seatType === "PROFESSIONAL" ? "professional" : "study"} className="mt-1 w-fit">
                {TIERS[seat.seatType].name}
              </Badge>
            </Fact>
          )}
          {timeSlot && (
            <Fact icon={<Clock className="size-5" />} label="Time slot">
              {formatTimeRange(timeSlot.startTime, timeSlot.endTime)}
            </Fact>
          )}
          <Fact icon={<CalendarDays className="size-5" />} label={`${items.length} ${items.length === 1 ? "day" : "days"}`}>
            {formatDateList(bookingDays(booking))}
          </Fact>
        </div>

        <div className="border-t border-line pt-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Day by day</h2>
          <ul className="divide-y divide-line rounded-md border border-line">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                <span className="tabular text-ink">{formatDay(item.date)}</span>
                <span className="tabular font-medium text-ink">{formatRupees(item.amountPaise)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex items-baseline justify-between gap-4">
            <span className="text-sm font-medium text-muted">Total</span>
            <span className="tabular font-display text-2xl font-extrabold text-ink">{formatRupees(booking.totalAmountPaise)}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function Fact({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">{icon}</span>
      <p className="flex min-w-0 flex-col">
        <span className="text-xs font-medium uppercase tracking-wide text-subtle">{label}</span>
        <span className="tabular flex flex-col font-semibold text-ink">{children}</span>
      </p>
    </div>
  );
}

// "2026-10-03T08:41:00Z" -> "3 Oct, 2:11 PM" in India time (fixed month names, so every browser writes the same)
function formatMadeOn(iso: string): string {
  const created = new Date(iso);
  if (Number.isNaN(created.getTime())) return "";
  const { date, time } = nowInIndia(created);
  return `${formatDayWithYear(date)}, ${formatTime(time)}`;
}
