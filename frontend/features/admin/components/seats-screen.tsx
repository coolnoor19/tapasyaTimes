"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Armchair, History, Pencil, Plus, Search, Wrench } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TIERS } from "@/features/landing/content";
import { cn } from "@/lib/cn";
import { StatTile } from "@/features/staff/components/stat-tile";
import { Pager } from "@/features/staff/components/pager";
import { QueryProblem } from "@/features/staff/components/query-problem";
import { useDebouncedValue } from "@/features/staff/hooks/use-staff-queries";
import { useSetUrlParams } from "@/features/staff/hooks/use-url-params";
import { parsePage } from "@/features/staff/lib/params";
import { useAdminSeats } from "../hooks/use-admin-queries";
import { filterSeats, floorsOf, parseSeatFilters, SEATS_PAGE_SIZE, summarizeSeats } from "../lib/seat-filters";
import type { AdminSeat, SeatStatus } from "../types";
import { SeatFormDialog } from "./seat-form-dialog";
import { emptyBox, selectClass } from "./shared";

const tierTone = (tier: AdminSeat["seatType"]) => (tier === "EXECUTIVE" ? "executive" : tier === "PROFESSIONAL" ? "professional" : "study");

const STATUS_VIEW: Record<SeatStatus, { label: string; tone: "leaf" | "warn" | "neutral" }> = {
  AVAILABLE: { label: "Available", tone: "leaf" },
  MAINTENANCE: { label: "Maintenance", tone: "warn" },
  INACTIVE: { label: "Switched off", tone: "neutral" },
};

const historyHref = (seat: AdminSeat) => `/admin/audit-log?targetType=SEAT&targetId=${seat.id}`;

// Every seat in the workspace. ONE request loads them all; the search box, the filters and the paging below work on that
// single answer in the browser, so they are instant and cost no requests. Seats are never deleted: a seat that is out of
// service is switched off, so its booking history stays intact.
export function SeatsScreen() {
  const params = useSearchParams();
  const setParams = useSetUrlParams();
  const query = useAdminSeats();
  const seats = query.data;

  const urlFilters = parseSeatFilters(params);
  const page = parsePage(params.get("page"));

  // What is typed filters at once; the address follows after a short pause (so a link can be shared) without a navigation per key press.
  const [text, setText] = useState(urlFilters.search);
  const settled = useDebouncedValue(text.trim().slice(0, 20));
  useEffect(() => {
    if (settled !== urlFilters.search) setParams({ q: settled || null, page: null });
  }, [settled, urlFilters.search, setParams]);

  const filters = { ...urlFilters, search: text.trim().slice(0, 20) };
  const summary = useMemo(() => (seats ? summarizeSeats(seats) : null), [seats]);
  const floors = useMemo(() => (seats ? floorsOf(seats) : []), [seats]);
  const { search, tier, status, floor } = filters;
  const filtered = useMemo(() => (seats ? filterSeats(seats, { search, tier, status, floor }) : []), [seats, search, tier, status, floor]);
  const pages = Math.max(1, Math.ceil(filtered.length / SEATS_PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * SEATS_PAGE_SIZE, current * SEATS_PAGE_SIZE);
  const hasFilters = Boolean(filters.search || filters.tier || filters.status || filters.floor !== undefined);

  const [editing, setEditing] = useState<AdminSeat | "new" | null>(null);

  const hrefFor = (target: number) => {
    const next = new URLSearchParams();
    if (filters.search) next.set("q", filters.search);
    if (filters.tier) next.set("tier", filters.tier);
    if (filters.status) next.set("status", filters.status);
    if (filters.floor !== undefined) next.set("floor", String(filters.floor));
    if (target > 1) next.set("page", String(target));
    const queryText = next.toString();
    return queryText ? `/admin/seats?${queryText}` : "/admin/seats";
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Seats"
        description="Every seat customers can book. A seat is switched off instead of deleted, so its history stays."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            Add seat
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={<Armchair className="size-5" />} label="Seats" value={summary?.total ?? 0} hint={summary ? `${summary.available} available` : undefined} loading={!summary} />
        <StatTile icon={<Wrench className="size-5" />} label="In maintenance" value={summary?.maintenance ?? 0} tone="warn" loading={!summary} />
        <StatTile icon={<Armchair className="size-5" />} label="Switched off" value={summary?.inactive ?? 0} tone="danger" loading={!summary} />
        <StatTile icon={<History className="size-5" />} label="With upcoming bookings" value={summary?.withUpcoming ?? 0} tone="leaf" loading={!summary} hint="can’t be switched off yet" />
      </div>

      <form className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" onSubmit={(event) => event.preventDefault()} role="search" aria-label="Filter seats">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          Seat number
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
            <Input value={text} onChange={(event) => setText(event.target.value)} placeholder="A07" autoComplete="off" spellCheck={false} maxLength={20} className="h-10 pl-9 uppercase placeholder:normal-case" />
          </div>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          Tier
          <select value={filters.tier ?? ""} onChange={(event) => setParams({ tier: event.target.value || null, page: null })} className={selectClass}>
            <option value="">Any tier</option>
            {(["EXECUTIVE", "PROFESSIONAL", "STUDY"] as const).map((tier) => (
              <option key={tier} value={tier}>
                {TIERS[tier].name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          Status
          <select value={filters.status ?? ""} onChange={(event) => setParams({ status: event.target.value || null, page: null })} className={selectClass}>
            <option value="">Any status</option>
            {Object.entries(STATUS_VIEW).map(([value, view]) => (
              <option key={value} value={value}>
                {view.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          Floor
          <select value={filters.floor === undefined ? "" : String(filters.floor)} onChange={(event) => setParams({ floor: event.target.value || null, page: null })} className={selectClass}>
            <option value="">Any floor</option>
            {floors.map((floor) => (
              <option key={floor} value={floor}>
                Floor {floor}
              </option>
            ))}
          </select>
        </label>
      </form>

      {hasFilters && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setText("");
              setParams({ q: null, tier: null, status: null, floor: null, page: null });
            }}
          >
            Clear all filters
          </Button>
        </div>
      )}

      {query.isError && !seats && <QueryProblem error={query.error} onRetry={() => query.refetch()} retrying={query.isFetching} what="the seats" />}

      {query.isPending && !query.isError && (
        <div className="flex flex-col gap-3" aria-busy="true">
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} className="h-14 rounded-lg" />
          ))}
        </div>
      )}

      {seats && seats.length === 0 && <p className={emptyBox}>No seats have been added yet. Use “Add seat” to create the first one.</p>}
      {seats && seats.length > 0 && filtered.length === 0 && <p className={emptyBox}>No seat matches these filters.</p>}

      {visible.length > 0 && (
        <div className={cn("flex flex-col gap-4 transition-opacity", query.isFetching && !query.isPending && "opacity-80")}>
          {query.isError && <Alert tone="warn" title="Showing the last list we loaded">We couldn’t refresh it just now.</Alert>}

          <div className="hidden overflow-hidden rounded-lg border border-line bg-surface shadow-card md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Seats</caption>
              <thead className="border-b border-line bg-canvas/60 text-xs uppercase tracking-wide text-subtle">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Seat</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Tier</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Floor</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Upcoming</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map((seat) => (
                  <tr key={seat.id} className="transition-colors hover:bg-brand-50/40">
                    <th scope="row" className="tabular px-4 py-3 font-semibold text-ink">{seat.seatNumber}</th>
                    <td className="px-4 py-3"><Badge tone={tierTone(seat.seatType)}>{TIERS[seat.seatType].name}</Badge></td>
                    <td className="tabular px-4 py-3 text-muted">{seat.floor}</td>
                    <td className="px-4 py-3"><Badge tone={STATUS_VIEW[seat.status].tone}>{STATUS_VIEW[seat.status].label}</Badge></td>
                    <td className="tabular px-4 py-3 text-right text-muted">{seat.upcomingBookings ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(seat)} aria-label={`Edit seat ${seat.seatNumber}`}>
                          <Pencil className="size-4" />
                          Edit
                        </Button>
                        <Button asChild variant="ghost" size="sm">
                          <Link href={historyHref(seat)} aria-label={`History of seat ${seat.seatNumber}`}>
                            <History className="size-4" />
                            History
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-3 md:hidden">
            {visible.map((seat) => (
              <li key={seat.id} className="rounded-lg border border-line bg-surface p-4 shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <p className="tabular font-display text-lg font-bold text-ink">{seat.seatNumber}</p>
                  <Badge tone={STATUS_VIEW[seat.status].tone}>{STATUS_VIEW[seat.status].label}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
                  <Badge tone={tierTone(seat.seatType)}>{TIERS[seat.seatType].name}</Badge>
                  <span>Floor {seat.floor}</span>
                  <span>· {seat.upcomingBookings ?? 0} upcoming</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setEditing(seat)}>
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={historyHref(seat)}>
                      <History className="size-4" />
                      History
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          <Pager page={current} pages={pages} total={filtered.length} hrefFor={hrefFor} label="Pages of seats" />
        </div>
      )}

      <SeatFormDialog target={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
