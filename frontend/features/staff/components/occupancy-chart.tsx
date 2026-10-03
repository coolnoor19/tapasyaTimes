"use client";

import { useId, useState } from "react";
import { TIERS } from "@/features/landing/content";
import { TIER_ORDER } from "@/features/seat-map/lib/seat-map";
import { cn } from "@/lib/cn";
import { formatDay, weekdayOf } from "@/lib/dates";
import type { OccupancyDay } from "../types";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const PLOT_HEIGHT = 180;
const TICKS = [100, 50, 0];

// Percent of seats-and-slots booked, one column per day. One measure on one axis (0 to 100%), so there is nothing to
// decode: no legend (a single series is named by the heading), no rainbow. Columns are thin (24px at most) with a 4px
// rounded top and a square base; the grid is a hairline. Hover or keyboard focus on a column fills the readout line above
// the plot (a fixed line, so it can never be clipped by the scrolling plot). The exact numbers are also in a table:
// hidden here for screen readers, and shown on the Occupancy page.
export function OccupancyChart({ days, today, dimmed = false, caption }: { days: OccupancyDay[]; today: string; dimmed?: boolean; caption: string }) {
  const [active, setActive] = useState<string | null>(null);
  const captionId = useId();
  const dense = days.length > 14;
  const shown = days.find((day) => day.date === active);

  return (
    <figure className={cn("transition-opacity", dimmed && "opacity-60")} aria-labelledby={captionId}>
      <figcaption id={captionId} className="sr-only">
        {caption}
      </figcaption>

      {/* the readout: value first, then which day */}
      <p className="mb-4 flex min-h-10 flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted" aria-hidden="true">
        {shown ? (
          <>
            <span className="tabular font-display text-xl font-bold text-ink">{shown.occupancyPercent}%</span>
            <span>
              {formatDay(shown.date)} · {shown.booked} of {shown.capacity} booked
            </span>
            <span className="tabular text-xs">
              {TIER_ORDER.map((tier) => `${TIERS[tier].name} ${shown.bySeatType[tier].booked}/${shown.bySeatType[tier].capacity}`).join(" · ")}
            </span>
          </>
        ) : (
          <span className="text-subtle">Point at a day for the details.</span>
        )}
      </p>

      <div className="flex gap-3">
        <div className="relative w-9 shrink-0 text-right text-xs text-subtle" style={{ height: PLOT_HEIGHT }} aria-hidden="true">
          {TICKS.map((tick) => (
            <span key={tick} className="tabular absolute right-0 -translate-y-1/2" style={{ top: `${100 - tick}%` }}>
              {tick}%
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto pb-1">
          <div className={cn(dense && "min-w-[44rem]")}>
            <div className="relative" style={{ height: PLOT_HEIGHT }}>
              {TICKS.map((tick) => (
                <span key={tick} aria-hidden="true" className="absolute inset-x-0 border-t border-line" style={{ top: `${100 - tick}%` }} />
              ))}

              <ul className="absolute inset-0 flex items-end">
                {days.map((day) => {
                  const isActive = active === day.date;
                  return (
                    <li key={day.date} className="relative flex h-full flex-1">
                      <button
                        type="button"
                        aria-label={`${formatDay(day.date)}: ${day.occupancyPercent}% booked, ${day.booked} of ${day.capacity}`}
                        onPointerEnter={() => setActive(day.date)}
                        onPointerLeave={() => setActive((current) => (current === day.date ? null : current))}
                        onFocus={() => setActive(day.date)}
                        onBlur={() => setActive((current) => (current === day.date ? null : current))}
                        // the hit area is the whole column, far bigger than the mark
                        className="group flex h-full w-full items-end justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-300"
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "w-full max-w-6 rounded-t-[4px] bg-brand-400 transition-[height,filter] duration-300 ease-out",
                            isActive && "brightness-125",
                            day.occupancyPercent === 0 && "opacity-50",
                          )}
                          style={{ height: day.occupancyPercent === 0 ? "2px" : `${Math.min(100, day.occupancyPercent)}%` }}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <ul className="mt-2 flex" aria-hidden="true">
              {days.map((day, index) => (
                <li key={day.date} className={cn("flex-1 text-center text-xs", day.date === today ? "font-semibold text-ink" : "text-subtle")}>
                  <span className="block">{dense && index % 2 === 1 ? "" : WEEKDAY[weekdayOf(day.date)]}</span>
                  <span className="tabular block">{Number(day.date.slice(8))}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* the wrapper is what is visually hidden: a table has its own width and would otherwise stretch the page */}
      <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Booked</th>
            <th scope="col">Capacity</th>
            <th scope="col">Occupancy</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.date}>
              <th scope="row">{formatDay(day.date)}</th>
              <td>{day.booked}</td>
              <td>{day.capacity}</td>
              <td>{day.occupancyPercent}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}
