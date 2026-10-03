"use client";

import { memo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Ban, Check, ChevronLeft, ChevronRight, Search, Timer, Wrench, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useServerNow } from "@/features/bookings/hooks/use-server-now";
import { cn } from "@/lib/cn";
import { addDays, formatDayWithYear, formatTimeRange, nowInIndia, todayInIndia, weekdayOf } from "@/lib/dates";
import { boardTotals, defaultSlotId, fullName, groupByFloor, seatMatches, slotPhase } from "../lib/board-math";
import { parseDate } from "../lib/params";
import { useBoard } from "../hooks/use-staff-queries";
import { useSetUrlParams } from "../hooks/use-url-params";
import type { BoardSeat } from "../types";
import { QueryProblem } from "./query-problem";
import { SeatDialog } from "./seat-dialog";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

// The floor for one day: pick a day and a time slot, see every seat and who has it. Click a seat for the details.
// The day and the slot live in the address (?date=&slot=), the search box is local to the page.
export function BoardScreen() {
  const params = useSearchParams();
  const setParams = useSetUrlParams();
  const nowMs = useServerNow(15_000);
  const india = nowInIndia(new Date(nowMs));
  const today = todayInIndia(new Date(nowMs));

  const requestedDate = parseDate(params.get("date"));
  const date = requestedDate ?? today;
  const board = useBoard(requestedDate === today ? undefined : requestedDate);
  const data = board.data;
  // while the next day loads, the old floor stays on screen (dimmed); it must not be mistaken for the new one
  const stale = board.isPlaceholderData || (data !== undefined && data.date !== date && !board.isError);

  const slotParam = params.get("slot");
  const slotId = data ? (data.slots.find((slot) => slot.timeSlot.id === slotParam)?.timeSlot.id ?? defaultSlotId(data, india.time)) : null;
  const slot = data?.slots.find((s) => s.timeSlot.id === slotId) ?? null;

  const [query, setQuery] = useState("");
  const [openSeatId, setOpenSeatId] = useState<string | null>(null);
  const [lastOpenedId, setLastOpenedId] = useState<string | null>(null);
  const openSeat = slot?.seats.find((seat) => seat.id === openSeatId) ?? null;

  const floors = slot ? groupByFloor(slot.seats) : [];
  const searching = query.trim() !== "";
  const matches = slot && searching ? slot.seats.filter((seat) => seatMatches(seat, query)).length : 0;
  const totals = data ? boardTotals(data) : null;
  const slotHeld = slot ? slot.seats.filter((seat) => seat.state === "BOOKED" && seat.booking?.itemStatus === "HELD").length : 0;
  const slotOut = slot ? slot.seats.filter((seat) => seat.state === "MAINTENANCE" || seat.state === "INACTIVE").length : 0;

  const go = (next: string) => setParams({ date: next === today ? null : next });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Floor board" description="Every seat for one day and time slot, and who has it." />

      {/* day controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5" role="group" aria-label="Choose the day">
          <Button variant="secondary" size="sm" aria-label="Previous day" onClick={() => go(addDays(date, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Input
            type="date"
            aria-label="Day"
            value={date}
            onChange={(event) => {
              const picked = parseDate(event.target.value);
              if (picked) go(picked); // a half-typed date is ignored until it is a real day
            }}
            className="h-9 w-44"
          />
          <Button variant="secondary" size="sm" aria-label="Next day" onClick={() => go(addDays(date, 1))}>
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" disabled={date === today} onClick={() => go(today)}>
            Today
          </Button>
        </div>
        <p className="text-sm text-muted" aria-live="polite">
          <span className="font-semibold text-ink">
            {WEEKDAYS[weekdayOf(date)]}, {formatDayWithYear(date)}
          </span>
          {date === today ? " · today" : date < today ? " · past" : ""}
        </p>
        <p className="ml-auto text-xs text-subtle">{board.isFetching && !board.isPending ? "Updating…" : "Updates itself every 30 seconds"}</p>
      </div>

      {board.isError && !data && <QueryProblem error={board.error} onRetry={() => board.refetch()} retrying={board.isFetching} what="the floor board" />}
      {board.isError && data && <Alert tone="warn" title="Showing the last floor we could load">The latest update failed. It will try again shortly.</Alert>}

      {board.isPending && !board.isError && <Skeleton className="h-96 rounded-lg" />}

      {data && data.slots.length === 0 && (
        <p className="rounded-lg border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center text-sm text-muted">
          There are no time slots to show for this day. An admin can set them up.
        </p>
      )}

      {data && slot && (
        <div className={cn("flex flex-col gap-6 transition-opacity", stale && "opacity-60")} aria-busy={stale || undefined}>
          {/* time slots */}
          <div role="tablist" aria-label="Time slots" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {data.slots.map((s) => {
              const selected = s.timeSlot.id === slot.timeSlot.id;
              const phase = slotPhase(s.timeSlot, data.isToday, india.time);
              return (
                <button
                  key={s.timeSlot.id}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  onClick={() => setParams({ slot: s.timeSlot.id })}
                  className={cn(
                    "flex shrink-0 flex-col items-start rounded-lg border px-4 py-2.5 text-left transition-colors focus-visible:outline-2",
                    selected ? "border-brand-400 bg-brand-50 text-ink" : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink",
                  )}
                >
                  <span className="tabular flex items-center gap-2 text-sm font-semibold">
                    {formatTimeRange(s.timeSlot.startTime, s.timeSlot.endTime)}
                    {phase === "now" && <span className="rounded-full bg-leaf-600 px-1.5 py-0.5 text-[0.625rem] font-bold uppercase text-surface">Now</span>}
                  </span>
                  <span className="tabular text-xs">
                    {s.summary.booked}/{s.summary.capacity} booked{!s.timeSlot.isActive ? " · switched off" : ""}
                  </span>
                </button>
              );
            })}
          </div>

          <Card>
            <CardContent className="flex flex-col gap-5">
              {/* numbers + search */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <Fact label="Booked" value={slot.summary.booked} />
                <Fact label="Free" value={slot.summary.available} />
                <Fact label="Unpaid holds" value={slotHeld} />
                <Fact label="Out of service" value={slotOut} />
                <div className="relative ml-auto w-full sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
                  <Input
                    type="search"
                    aria-label="Find a seat or customer"
                    placeholder="Find a seat or customer"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="h-10 pl-9 pr-9"
                    maxLength={100}
                  />
                  {searching && (
                    <button type="button" aria-label="Clear the search" onClick={() => setQuery("")} className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-subtle hover:text-ink">
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              </div>
              {searching && (
                <p className="text-sm text-muted" role="status">
                  {matches === 0 ? "No seat or booking in this slot matches that." : `${matches} ${matches === 1 ? "seat matches" : "seats match"}.`}
                </p>
              )}

              <Legend />

              {slot.seats.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted">No seats have been set up yet.</p>
              ) : (
                <div className="flex flex-col gap-8">
                  {floors.map((floor) => (
                    <section key={floor.floor} aria-label={`Floor ${floor.floor}`}>
                      <h2 className="mb-3 flex items-baseline gap-3 text-sm font-semibold text-ink">
                        Floor {floor.floor}
                        <span className="tabular text-xs font-normal text-muted">
                          {floor.bookedCount} of {floor.seatCount} booked
                        </span>
                      </h2>
                      <div className="flex flex-col gap-2.5">
                        {floor.rows.map((row) => (
                          <div key={row.label || "other"} className="flex items-center gap-3">
                            <span className="w-5 shrink-0 text-center text-xs font-semibold text-subtle" aria-hidden="true">
                              {row.label}
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {row.seats.map((seat) => (
                                <SeatTile key={seat.id} seat={seat} dim={searching && !seatMatches(seat, query)} onOpen={(id) => { setLastOpenedId(id); setOpenSeatId(id); }} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {totals && !data.isToday && <p className="text-xs text-subtle">All times are India time. Unpaid holds that have already run out are not shown as taken.</p>}
        </div>
      )}

      <SeatDialog seat={openSeat} date={data?.date ?? date} slotLabel={slot ? formatTimeRange(slot.timeSlot.startTime, slot.timeSlot.endTime) : ""} onClose={() => setOpenSeatId(null)} returnFocusId={lastOpenedId} />
    </div>
  );
}

function Fact({ label, value }: { label: string; value: number }) {
  return (
    <p>
      <span className="block text-xs font-medium uppercase tracking-wide text-subtle">{label}</span>
      <span className="tabular font-display text-2xl font-bold text-ink">{value}</span>
    </p>
  );
}

function Legend() {
  const item = "flex items-center gap-2 text-xs text-muted";
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-4" aria-label="Legend">
      <li className={item}>
        <span className="size-4 rounded border border-line-strong bg-surface" aria-hidden="true" /> Free
      </li>
      <li className={item}>
        <span className="grid size-4 place-items-center rounded bg-brand-600 text-white" aria-hidden="true"><Check className="size-3" /></span> Booked and paid
      </li>
      <li className={item}>
        <span className="grid size-4 place-items-center rounded border border-dashed border-warn-600 bg-warn-50 text-warn-600" aria-hidden="true"><Timer className="size-3" /></span> Unpaid hold
      </li>
      <li className={item}>
        <span className="grid size-4 place-items-center rounded bg-danger-50 text-danger-600" aria-hidden="true"><Wrench className="size-3" /></span> Maintenance
      </li>
      <li className={item}>
        <span className="grid size-4 place-items-center rounded bg-canvas text-subtle ring-1 ring-inset ring-line" aria-hidden="true"><Ban className="size-3" /></span> Switched off
      </li>
    </ul>
  );
}

// One seat. Colour AND an icon say what state it is in, so nothing depends on telling colours apart.
const SeatTile = memo(function SeatTile({ seat, dim, onOpen }: { seat: BoardSeat; dim: boolean; onOpen: (id: string) => void }) {
  const booking = seat.booking;
  const held = seat.state === "BOOKED" && booking?.itemStatus === "HELD";
  const paid = seat.state === "BOOKED" && !held;

  const status = seat.state === "AVAILABLE" ? "free" : seat.state === "MAINTENANCE" ? "under maintenance" : seat.state === "INACTIVE" ? "switched off" : held ? "unpaid hold" : "booked and paid";
  const label = `Seat ${seat.seatNumber}, ${status}${booking ? `, ${fullName(booking.customer)}` : ""}`;

  return (
    <button
      type="button"
      onClick={() => onOpen(seat.id)}
      data-seat-id={seat.id}
      aria-label={label}
      title={label}
      className={cn(
        "relative flex h-16 w-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-center transition-[opacity,transform,box-shadow] hover:-translate-y-0.5 focus-visible:outline-2",
        seat.state === "AVAILABLE" && "border border-line-strong bg-surface text-muted hover:text-ink",
        paid && "bg-brand-600 text-white",
        held && "border border-dashed border-warn-600 bg-warn-50 text-warn-600",
        seat.state === "MAINTENANCE" && "bg-danger-50 text-danger-600",
        seat.state === "INACTIVE" && "bg-canvas text-subtle ring-1 ring-inset ring-line",
        dim && "opacity-20",
      )}
    >
      <span className="tabular flex items-center gap-1 text-sm font-bold leading-none">
        {paid && <Check className="size-3" aria-hidden="true" />}
        {held && <Timer className="size-3" aria-hidden="true" />}
        {seat.state === "MAINTENANCE" && <Wrench className="size-3" aria-hidden="true" />}
        {seat.state === "INACTIVE" && <Ban className="size-3" aria-hidden="true" />}
        {seat.seatNumber}
      </span>
      {booking && <span className="w-full truncate text-[0.6875rem] leading-none opacity-90">{booking.customer.firstName}</span>}
    </button>
  );
});
