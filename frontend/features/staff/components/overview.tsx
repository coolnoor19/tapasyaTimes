"use client";

import Link from "next/link";
import { ArrowRight, CalendarCheck, Hourglass, LayoutGrid, Wrench } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/hooks/use-session";
import { useServerNow } from "@/features/bookings/hooks/use-server-now";
import { formatDayWithYear, formatTimeRange, nowInIndia, todayInIndia, weekdayOf } from "@/lib/dates";
import { boardTotals, slotPhase, type SlotPhase } from "../lib/board-math";
import { useBoard, useOccupancy, useStaffBookings } from "../hooks/use-staff-queries";
import type { BoardSlot } from "../types";
import { OccupancyChart } from "./occupancy-chart";
import { QueryProblem } from "./query-problem";
import { StaffBookingList } from "./staff-booking-list";
import { StatTile } from "./stat-tile";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

const greeting = (hour: number) => (hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");

// The landing page for managers and admins: how today looks, how the coming week looks, and what was booked last.
// Everything here is read-only and refreshes by itself while the page is open.
export function Overview() {
  const { user } = useSession();
  const nowMs = useServerNow(15_000);
  const india = nowInIndia(new Date(nowMs));

  const board = useBoard(undefined);
  const occupancy = useOccupancy({});
  const recent = useStaffBookings({}, 1, { limit: 6, live: true });

  const data = board.data;
  const totals = data ? boardTotals(data) : null;
  const current = data?.slots.find((slot) => slotPhase(slot.timeSlot, data.isToday, india.time) === "now");
  const nextUp = data?.slots.find((slot) => slotPhase(slot.timeSlot, data.isToday, india.time) === "upcoming");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`${greeting(Number(india.time.slice(0, 2)))}${user ? `, ${user.firstName}` : ""}`}
        description={`${WEEKDAYS[weekdayOf(india.date)]}, ${formatDayWithYear(india.date)}. Here is how the floor looks.`}
        actions={
          <Button asChild size="sm">
            <Link href="/manager/board">
              <LayoutGrid className="size-4" />
              Open the floor board
            </Link>
          </Button>
        }
      />

      {board.isError && !data && <QueryProblem error={board.error} onRetry={() => board.refetch()} retrying={board.isFetching} what="today’s floor" />}

      {data && totals && totals.capacity === 0 && (
        <Alert tone="info" title="Nothing is bookable yet">
          There are no seats in service or no active time slots, so there is nothing to count. An admin can set these up.
        </Alert>
      )}

      {/* today at a glance */}
      <section aria-label="Today at a glance" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<CalendarCheck className="size-5" />}
          label="Booked today"
          loading={!totals}
          value={totals ? `${totals.occupancyPercent}%` : ""}
          hint={totals ? `${totals.booked} of ${totals.capacity} seat-slots` : undefined}
        />
        <StatTile
          tone="warn"
          icon={<Hourglass className="size-5" />}
          label="Unpaid holds"
          loading={!totals}
          value={totals?.held ?? 0}
          hint="Held for 10 minutes while the customer pays"
        />
        <StatTile
          tone="leaf"
          icon={<LayoutGrid className="size-5" />}
          label={current ? "Free right now" : "Free in the next slot"}
          loading={!data}
          value={current ? current.summary.available : nextUp ? nextUp.summary.available : "—"}
          hint={current ? current.timeSlot.displayName : nextUp ? formatTimeRange(nextUp.timeSlot.startTime, nextUp.timeSlot.endTime) : "No slot is open now"}
        />
        <StatTile
          tone="danger"
          icon={<Wrench className="size-5" />}
          label="Out of service"
          loading={!totals}
          value={totals?.outOfService ?? 0}
          hint="Seats in maintenance or switched off"
        />
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Today by time slot</CardTitle>
            <CardDescription>How full each slot is.</CardDescription>
          </CardHeader>
          <CardContent>
            {!data ? (
              <div className="flex flex-col gap-4">
                {[0, 1, 2].map((row) => (
                  <Skeleton key={row} className="h-14" />
                ))}
              </div>
            ) : data.slots.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">No time slots are set up.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {data.slots.map((slot) => (
                  <SlotRow key={slot.timeSlot.id} slot={slot} phase={slotPhase(slot.timeSlot, data.isToday, india.time)} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Occupancy, next 7 days</CardTitle>
              <CardDescription>Share of seats booked, across all time slots.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/manager/occupancy">
                Details
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {occupancy.isError && !occupancy.data ? (
              <QueryProblem error={occupancy.error} onRetry={() => occupancy.refetch()} retrying={occupancy.isFetching} what="the occupancy chart" />
            ) : !occupancy.data ? (
              <Skeleton className="h-60" />
            ) : (
              <OccupancyChart days={occupancy.data.days} today={todayInIndia(new Date(nowMs))} dimmed={occupancy.isPlaceholderData} caption="Share of seats booked on each of the next 7 days" />
            )}
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="recent-heading" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 id="recent-heading" className="text-lg font-bold text-ink">
            Latest bookings
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/manager/bookings">
              All bookings
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        {recent.isError && !recent.data ? (
          <QueryProblem error={recent.error} onRetry={() => recent.refetch()} retrying={recent.isFetching} what="the latest bookings" />
        ) : !recent.data ? (
          <Skeleton className="h-64 rounded-lg" />
        ) : recent.data.data.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong bg-surface/60 px-6 py-10 text-center text-sm text-muted">No bookings have been made yet.</p>
        ) : (
          <StaffBookingList bookings={recent.data.data} nowMs={nowMs} />
        )}
      </section>

      {user?.role === "ADMIN" && (
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-bold text-ink">Admin tools</h2>
              <p className="text-sm text-muted">Change what customers can book, and who can do what.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { href: "/admin/seats", label: "Seats" },
                { href: "/admin/time-slots", label: "Time slots" },
                { href: "/admin/prices", label: "Prices" },
                { href: "/admin/users", label: "Users and roles" },
                { href: "/admin/audit-log", label: "Audit log" },
              ].map((tool) => (
                <Button key={tool.href} asChild variant="secondary" size="sm">
                  <Link href={tool.href}>{tool.label}</Link>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const PHASE_BADGE: Record<SlotPhase, { label: string; tone: "leaf" | "neutral" | "brand" } | null> = {
  now: { label: "Now", tone: "leaf" },
  upcoming: { label: "Later today", tone: "brand" },
  done: { label: "Finished", tone: "neutral" },
  "other-day": null,
};

function SlotRow({ slot, phase }: { slot: BoardSlot; phase: SlotPhase }) {
  const { capacity, booked, available } = slot.summary;
  const percent = capacity === 0 ? 0 : Math.min(100, (booked / capacity) * 100);
  const badge = PHASE_BADGE[phase];
  return (
    <li>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-ink">
          <span className="tabular">{formatTimeRange(slot.timeSlot.startTime, slot.timeSlot.endTime)}</span>
          {!slot.timeSlot.isActive && <span className="ml-2 text-xs font-normal text-subtle">(switched off)</span>}
        </p>
        {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" role="img" aria-label={`${booked} of ${capacity} seats booked`}>
        <div className="h-full rounded-full bg-brand-400 transition-[width] duration-500" style={{ width: `${percent}%` }} />
      </div>
      <p className="tabular mt-1.5 text-xs text-muted">
        {booked} booked · {available} free
      </p>
    </li>
  );
}
