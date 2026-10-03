"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useServerNow } from "@/features/bookings/hooks/use-server-now";
import { TIERS } from "@/features/landing/content";
import { TIER_ORDER } from "@/features/seat-map/lib/seat-map";
import { cn } from "@/lib/cn";
import { formatDay, formatDayWithYear, todayInIndia } from "@/lib/dates";
import { RANGE_PRESETS, MAX_RANGE_DAYS, rangeProblemText, resolveRange, type RangeProblem } from "../lib/params";
import { useOccupancy } from "../hooks/use-staff-queries";
import { useSetUrlParams } from "../hooks/use-url-params";
import { OccupancyChart } from "./occupancy-chart";
import { QueryProblem } from "./query-problem";

// How full the space is, day by day, for any range of up to 31 days (past or future). The range lives in the address.
export function OccupancyScreen() {
  const params = useSearchParams();
  const setParams = useSetUrlParams();
  const nowMs = useServerNow(30_000);
  const today = todayInIndia(new Date(nowMs));

  const { range, problem } = resolveRange(params, today);
  const query = useOccupancy(range);
  const data = query.data;
  const stale = query.isPlaceholderData;

  const stats = useMemo(() => {
    if (!data || data.days.length === 0 || data.summary.capacity === 0) return null;
    const busiest = data.days.reduce((best, day) => (day.occupancyPercent > best.occupancyPercent ? day : best));
    const quietest = data.days.reduce((best, day) => (day.occupancyPercent < best.occupancyPercent ? day : best));
    return { busiest, quietest };
  }, [data]);

  const activePreset = RANGE_PRESETS.find((preset) => {
    const made = preset.make(today);
    return made.from === range.from && made.to === range.to;
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Occupancy" description="How full the space is, day by day." />

      {/* filters: one row above everything they scope */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Quick ranges">
          {RANGE_PRESETS.map((preset) => {
            const made = preset.make(today);
            const on = activePreset?.id === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={on}
                onClick={() => setParams({ from: made.from, to: made.to })}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  on ? "border-brand-400 bg-brand-50 text-brand-800" : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink",
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <CustomRange key={`${range.from}_${range.to}`} initialFrom={range.from} initialTo={range.to} today={today} onApply={(from, to) => setParams({ from, to })} />
      </div>

      {problem && <Alert tone="warn" title="That range can’t be shown">{rangeProblemText[problem]}</Alert>}

      {query.isError && !data && <QueryProblem error={query.error} onRetry={() => query.refetch()} retrying={query.isFetching} what="occupancy" />}

      {query.isPending && !query.isError && (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
      )}

      {data && (
        <div className="flex flex-col gap-6">
          {data.summary.capacity === 0 && (
            <Alert tone="info" title="Nothing is bookable yet">
              There are no seats in service or no active time slots, so every day shows 0%.
            </Alert>
          )}

          <section aria-label="Summary" className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", stale && "opacity-60 transition-opacity")}>
            <Summary label="Average occupancy" value={`${data.summary.occupancyPercent}%`} hint={`${data.days.length} ${data.days.length === 1 ? "day" : "days"}, ${formatDayWithYear(data.from)}${data.days.length > 1 ? ` to ${formatDayWithYear(data.to)}` : ""}`} />
            <Summary label="Seat-slots booked" value={data.summary.booked} hint={`of ${data.summary.capacity} available`} />
            <Summary label="Busiest day" value={stats ? `${stats.busiest.occupancyPercent}%` : "—"} hint={stats ? formatDay(stats.busiest.date) : "No data"} />
            <Summary label="Quietest day" value={stats ? `${stats.quietest.occupancyPercent}%` : "—"} hint={stats ? formatDay(stats.quietest.date) : "No data"} />
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Share of seats booked</CardTitle>
              <CardDescription>
                {data.activeTimeSlots} active time {data.activeTimeSlots === 1 ? "slot" : "slots"}. A seat in two slots counts twice.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OccupancyChart days={data.days} today={today} dimmed={stale} caption={`Share of seats booked each day from ${formatDay(data.from)} to ${formatDay(data.to)}`} />
            </CardContent>
          </Card>

          <section aria-labelledby="table-heading" className={cn("flex flex-col gap-3", stale && "opacity-60 transition-opacity")}>
            <h2 id="table-heading" className="text-lg font-bold text-ink">
              Day by day
            </h2>
            <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-card">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="border-b border-line bg-canvas/60 text-xs uppercase tracking-wide text-subtle">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Day</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Booked</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Occupancy</th>
                    {TIER_ORDER.map((tier) => (
                      <th key={tier} scope="col" className="px-4 py-3 text-right font-semibold">
                        {TIERS[tier].name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.days.map((day) => (
                    <tr key={day.date} className={day.date === today ? "bg-brand-50/40" : undefined}>
                      <th scope="row" className="tabular px-4 py-3 font-medium text-ink">
                        {formatDay(day.date)}
                        {day.date === today && <span className="ml-2 text-xs font-normal text-brand-700">today</span>}
                      </th>
                      <td className="tabular px-4 py-3 text-right text-muted">
                        {day.booked} / {day.capacity}
                      </td>
                      <td className="tabular px-4 py-3 text-right font-semibold text-ink">{day.occupancyPercent}%</td>
                      {TIER_ORDER.map((tier) => (
                        <td key={tier} className="tabular px-4 py-3 text-right text-muted">
                          {day.bySeatType[tier].capacity === 0 ? "—" : `${day.bySeatType[tier].occupancyPercent}%`}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-subtle">
              Capacity uses today’s seats and time slots for every day, because the system does not keep a history of changes. Past days are measured against the current setup. Unpaid holds that ran out are not counted.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

function Summary({ label, value, hint }: { label: string; value: React.ReactNode; hint: string }) {
  return (
    <Card>
      <CardContent className="!p-5">
        <p className="text-sm text-muted">{label}</p>
        <p className="font-display text-3xl font-bold leading-tight text-ink">{value}</p>
        <p className="mt-0.5 text-[0.8125rem] text-subtle">{hint}</p>
      </CardContent>
    </Card>
  );
}

// Two day pickers and Apply. The typed values stay a draft until they make a valid range, so a half-finished edit never
// reaches the address bar or the backend (which refuses ranges that are reversed or longer than 31 days).
function CustomRange({ initialFrom, initialTo, today, onApply }: { initialFrom: string; initialTo: string; today: string; onApply: (from: string, to: string) => void }) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  const draft = resolveRange({ get: (key) => (key === "from" ? from : key === "to" ? to : null) }, today);
  const problem: RangeProblem | null = from === "" ? "incomplete" : to === "" ? "incomplete" : draft.problem;
  const unchanged = from === initialFrom && to === initialTo;

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!problem) onApply(from, to);
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        From
        <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-10 w-44" invalid={problem === "order" || problem === "incomplete"} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        To
        <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-10 w-44" invalid={problem === "order" || problem === "too-long" || problem === "incomplete"} />
      </label>
      <Button type="submit" variant="secondary" disabled={problem !== null || unchanged}>
        <CalendarRange className="size-4" />
        Show range
      </Button>
      {problem && !unchanged && (
        <p role="alert" className="basis-full text-[0.8125rem] text-danger-600">
          {problem === "order" ? "The end day must not be before the start day." : problem === "too-long" ? `Pick at most ${MAX_RANGE_DAYS} days.` : "Pick both a start day and an end day."}
        </p>
      )}
    </form>
  );
}
