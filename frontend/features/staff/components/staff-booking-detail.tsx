"use client";

import Link from "next/link";
import { ArrowLeft, Armchair, CalendarDays, Clock, Mail, Phone, UserRound } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BookingStatusBadge } from "@/features/bookings/components/booking-status-badge";
import { HoldCountdown } from "@/features/bookings/components/hold-countdown";
import { useServerNow } from "@/features/bookings/hooks/use-server-now";
import { bookingDays, bookingPhase, type BookingPhase } from "@/features/bookings/lib/booking-state";
import { TIERS } from "@/features/landing/content";
import { formatDateList, formatDay, formatDayWithYear, formatTime, formatTimeRange, nowInIndia, todayInIndia } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { fullName } from "../lib/board-math";
import { useStaffBooking } from "../hooks/use-staff-queries";
import type { StaffBooking } from "../types";
import { isNotFound, QueryProblem } from "./query-problem";

const ITEM_LABEL = { HELD: "Held", CONFIRMED: "Paid", RELEASED: "Released" } as const;

// One booking as staff see it: the customer first (staff usually look it up to call them), then the seat, slot and days.
export function StaffBookingDetail({ id }: { id: string }) {
  const query = useStaffBooking(id);
  const nowMs = useServerNow();
  const booking = query.data;
  const phase = booking ? bookingPhase(booking, nowMs, todayInIndia(new Date(nowMs))) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={booking ? `Booking ${booking.bookingCode}` : "Booking"}
        description={booking ? `Made on ${madeOn(booking.createdAt)}` : undefined}
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/manager/bookings">
              <ArrowLeft className="size-4" />
              All bookings
            </Link>
          </Button>
        }
      />

      {query.isError && isNotFound(query.error) && (
        <Alert tone="warn" title="We can’t find that booking" action={<Button asChild size="sm" variant="secondary"><Link href="/manager/bookings">Search bookings</Link></Button>}>
          The link may be wrong, or the booking no longer exists.
        </Alert>
      )}
      {query.isError && !isNotFound(query.error) && !booking && <QueryProblem error={query.error} onRetry={() => query.refetch()} retrying={query.isFetching} what="this booking" />}
      {query.isPending && !query.isError && (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      )}

      {booking && phase && (
        <>
          <Status booking={booking} phase={phase} nowMs={nowMs} />
          <div className="grid items-start gap-6 lg:grid-cols-[22rem_1fr]">
            <CustomerCard booking={booking} />
            <Details booking={booking} phase={phase} />
          </div>
        </>
      )}
    </div>
  );
}

function Status({ booking, phase, nowMs }: { booking: StaffBooking; phase: BookingPhase; nowMs: number }) {
  if (phase === "held") {
    return (
      <Card className="border-warn-600/30">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <HoldCountdown booking={booking} nowMs={nowMs} className="min-w-64" />
          <p className="max-w-md text-sm leading-relaxed text-muted">
            The customer has not paid yet. The seat is held for them until the timer ends; after that it is free for anyone.
          </p>
        </CardContent>
      </Card>
    );
  }
  if (phase === "expired") {
    return (
      <Alert tone="warn" title="The hold ended without payment">
        The customer did not pay in time, so the seat was given back. Nothing was charged.
      </Alert>
    );
  }
  if (phase === "confirmed") return <Alert tone="success" title="Confirmed and paid" />;
  if (phase === "completed") return <Alert tone="info" title="This booking is complete" />;
  return <Alert tone="danger" title="This booking was cancelled" />;
}

function CustomerCard({ booking }: { booking: StaffBooking }) {
  const { customer } = booking;
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700" aria-hidden="true">
            <UserRound className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-subtle">Customer</p>
            <Link href={`/manager/customers/${customer.id}`} className="block truncate font-display text-lg font-bold text-ink hover:underline">
              {fullName(customer)}
            </Link>
          </div>
        </div>
        <ul className="flex flex-col gap-2 text-sm">
          <li>
            <a href={`tel:${customer.phone}`} className="tabular flex items-center gap-2 text-brand-700 hover:text-brand-800 hover:underline">
              <Phone className="size-4 shrink-0" aria-hidden="true" />
              {customer.phone}
            </a>
          </li>
          <li className="min-w-0">
            <a href={`mailto:${customer.email}`} className="flex items-center gap-2 text-brand-700 hover:text-brand-800 hover:underline">
              <Mail className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{customer.email}</span>
            </a>
          </li>
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href={`/manager/customers/${customer.id}`}>View customer</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/manager/bookings?customerId=${customer.id}`}>Their bookings</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Details({ booking, phase }: { booking: StaffBooking; phase: BookingPhase }) {
  const { seat, timeSlot, items } = booking;
  return (
    <Card>
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
                <span className="flex items-center gap-4">
                  <span className="text-xs text-muted">{ITEM_LABEL[item.status]}</span>
                  <span className="tabular w-20 text-right font-medium text-ink">{formatRupees(item.amountPaise)}</span>
                </span>
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
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700" aria-hidden="true">
        {icon}
      </span>
      <p className="flex min-w-0 flex-col">
        <span className="text-xs font-medium uppercase tracking-wide text-subtle">{label}</span>
        <span className="tabular flex flex-col font-semibold text-ink">{children}</span>
      </p>
    </div>
  );
}

// "3 Oct, 2:11 PM" in India time (fixed month names, so every browser writes the same)
function madeOn(iso: string): string {
  const created = new Date(iso);
  if (Number.isNaN(created.getTime())) return "";
  const { date, time } = nowInIndia(created);
  return `${formatDayWithYear(date)}, ${formatTime(time)}`;
}
