"use client";

import { memo, useId, useRef, type KeyboardEvent } from "react";
import { motion } from "motion/react";
import { TIERS } from "@/features/landing/content";
import { cn } from "@/lib/cn";
import { formatRupees } from "@/lib/money";
import { isNavigationKey, nextSeatId, type SeatPoint } from "../lib/seat-navigation";
import type { MapFloor, MapSeat } from "../lib/seat-map";
import { SeatButton } from "./seat-button";

interface SeatMapViewProps {
  floor: MapFloor;
  selectedId: string | null;
  // the one seat that is a tab stop
  tabbableId: string | null;
  daysChosen: number;
  onPick: (seat: MapSeat) => void;
  onFocusSeat: (seatId: string) => void;
}

// One floor of the plan: the reception curve, then each tier as a block of rows.
// memo: it repaints only when the floor's data, the selection or the tab stop really changes.
export const SeatMapView = memo(function SeatMapView({ floor, selectedId, tabbableId, daysChosen, onPick, onFocusSeat }: SeatMapViewProps) {
  const root = useRef<HTMLDivElement>(null);
  let order = 0; // counts seats as they are drawn, to stagger their entrance across the whole floor

  // Arrow keys / Home / End move to the nearest seat on screen.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!isNavigationKey(event.key) || !root.current) return;
    const current = (event.target as HTMLElement).closest<HTMLElement>("[data-seat-id]");
    if (!current) return;

    const buttons = [...root.current.querySelectorAll<HTMLElement>("[data-seat-id]")];
    const points: SeatPoint[] = buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return { id: button.dataset.seatId!, x: box.left + box.width / 2, y: box.top + box.height / 2 };
    });
    const from = points.find((point) => point.id === current.dataset.seatId);
    const targetId = from ? nextSeatId(from, points, event.key) : null;
    if (!targetId) return;

    event.preventDefault(); // the page must not scroll while moving between seats
    const target = buttons.find((button) => button.dataset.seatId === targetId);
    target?.focus();
    target?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  return (
    <div ref={root} role="group" aria-label={`Floor ${floor.floor} seat map`} onKeyDown={handleKeyDown}>
      <Reception />

      {/* a plan wider than the screen scrolls sideways; seats keep their full touch size */}
      <div className="-mx-2 overflow-x-auto px-2 pb-4 [scrollbar-width:thin]">
        <div className="mx-auto flex w-fit flex-col gap-10">
          {floor.sections.map((section) => (
            <section key={section.tier} aria-label={`${TIERS[section.tier].name} seats`}>
              <header className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span aria-hidden="true" className={cn("size-2.5 rounded-full", TIERS[section.tier].dot)} />
                <h3 className="font-display text-base font-bold text-ink">{TIERS[section.tier].name}</h3>
                <span className="tabular text-sm font-semibold text-ink">
                  {section.pricePerDayPaise === null ? "Price not set" : `${formatRupees(section.pricePerDayPaise)} per day`}
                </span>
                <span className="ml-auto text-xs font-medium text-muted">
                  {section.freeCount} of {section.seatCount} free
                </span>
              </header>

              <div className="flex flex-col gap-2.5">
                {section.rows.map((row, rowIndex) => (
                  <div key={`${row.label}-${rowIndex}`} className="flex items-center gap-2">
                    <span aria-hidden="true" className="w-7 shrink-0 truncate text-center text-xs font-bold text-subtle">
                      {row.label}
                    </span>
                    {row.cells.map((seat, column) =>
                      seat ? (
                        <SeatButton
                          key={seat.id}
                          seat={seat}
                          selected={seat.id === selectedId}
                          tabbable={seat.id === tabbableId}
                          daysChosen={daysChosen}
                          enterDelay={Math.min(order++ * 12, 420)}
                          onPick={onPick}
                          onFocusSeat={onFocusSeat}
                        />
                      ) : (
                        // an aisle
                        <span key={`gap-${column}`} aria-hidden="true" className="w-4 shrink-0 sm:w-6" />
                      ),
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
});

// The reception desk, where a cinema would have its screen. The curve draws itself in.
function Reception() {
  const gradient = `reception-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <div aria-hidden="true" className="mx-auto mb-9 w-4/5 max-w-lg">
      <svg viewBox="0 0 320 30" className="w-full overflow-visible">
        <defs>
          <linearGradient id={gradient} x1="0" x2="1">
            <stop offset="0" stopColor="#1f58d8" stopOpacity="0" />
            <stop offset="0.5" stopColor="#1f58d8" stopOpacity="0.6" />
            <stop offset="1" stopColor="#0a9a5a" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          d="M4 26 Q160 -8 316 26"
          fill="none"
          stroke={`url(#${gradient})`}
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <p className="-mt-0.5 text-center text-[0.625rem] font-semibold uppercase tracking-[0.3em] text-subtle">Reception</p>
    </div>
  );
}
