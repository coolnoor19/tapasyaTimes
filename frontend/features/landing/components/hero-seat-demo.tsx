"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, MousePointerClick } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatPerHour } from "@/lib/money";
import { TIERS } from "../content";
import type { SeatTier } from "../types";
import { useOverview } from "../api/use-overview";

// A small, working taste of the seat map: tap a seat and it is "yours". The real map (with real availability)
// is built in a later phase; this one is for the landing page only, so its seats and "taken" marks are for show.

const COLUMNS = 6;
const ROWS: { label: string; tier: SeatTier; taken: number[] }[] = [
  { label: "A", tier: "EXECUTIVE", taken: [1, 4] },
  { label: "B", tier: "PROFESSIONAL", taken: [0, 3] },
  { label: "C", tier: "STUDY", taken: [2, 5] },
];

// Whole class names so Tailwind can see them.
const FREE_LOOK: Record<SeatTier, string> = {
  EXECUTIVE: "border-brand-300 bg-brand-50 hover:border-tier-executive hover:bg-brand-100",
  PROFESSIONAL: "border-[#a9dde1] bg-[#e6f6f7] hover:border-tier-professional hover:bg-[#d3eff1]",
  STUDY: "border-leaf-200 bg-leaf-50 hover:border-tier-study hover:bg-leaf-100",
};

export function HeroSeatDemo() {
  const [selected, setSelected] = useState<string | null>("B3");
  const { data } = useOverview();

  const row = ROWS.find((r) => selected?.startsWith(r.label));
  const price = row ? data?.tiers.find((tier) => tier.seatType === row.tier)?.pricePerHourPaise : null;

  return (
    <div className="relative">
      {/* soft glow behind the card */}
      <div aria-hidden="true" className="absolute -inset-6 -z-10 rounded-[2rem] bg-[radial-gradient(closest-side,var(--color-brand-200),transparent)] opacity-60 blur-2xl" />

      <div className="rounded-2xl border border-line bg-surface p-5 shadow-pop sm:p-7">
        {/* the reception desk, where a cinema would have its screen */}
        <div aria-hidden="true" className="mx-auto mb-6 w-4/5">
          <svg viewBox="0 0 320 30" className="w-full overflow-visible">
            <defs>
              <linearGradient id="hero-reception" x1="0" x2="1">
                <stop offset="0" stopColor="#1f58d8" stopOpacity="0" />
                <stop offset="0.5" stopColor="#1f58d8" stopOpacity="0.55" />
                <stop offset="1" stopColor="#0a9a5a" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M4 26 Q160 -8 316 26" fill="none" stroke="url(#hero-reception)" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <p className="-mt-0.5 text-center text-[0.625rem] font-semibold uppercase tracking-[0.3em] text-subtle">Reception</p>
        </div>

        <div role="group" aria-label="Sample seat map. Choose a seat to try it." className="flex flex-col gap-3.5">
          {ROWS.map((rowDef, rowIndex) => (
            <div key={rowDef.label} className="flex items-center gap-3">
              <span aria-hidden="true" className="w-4 text-center text-xs font-bold text-subtle">
                {rowDef.label}
              </span>
              <div className="grid flex-1 grid-cols-6 gap-2 sm:gap-3">
                {Array.from({ length: COLUMNS }, (_, col) => {
                  const id = `${rowDef.label}${col + 1}`;
                  const taken = rowDef.taken.includes(col);
                  const isSelected = selected === id;
                  const tier = TIERS[rowDef.tier].name;

                  return (
                    <motion.button
                      key={id}
                      type="button"
                      disabled={taken}
                      aria-pressed={taken ? undefined : isSelected}
                      aria-label={`Seat ${id}, ${tier}, ${taken ? "taken" : isSelected ? "selected" : "available"}`}
                      onClick={() => setSelected(isSelected ? null : id)}
                      initial={{ opacity: 0, scale: 0.5, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ delay: 0.3 + rowIndex * 0.1 + col * 0.045, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      whileHover={taken ? undefined : { y: -3, scale: 1.07 }}
                      whileTap={taken ? undefined : { scale: 0.92 }}
                      className={cn(
                        "relative grid h-10 place-items-center rounded-t-xl rounded-b-lg border-2 transition-colors duration-200 sm:h-12",
                        "focus-visible:outline-none focus-visible:shadow-ring",
                        taken && "cursor-not-allowed border-line bg-[repeating-linear-gradient(135deg,var(--color-line)_0_4px,var(--color-canvas)_4px_8px)]",
                        !taken && !isSelected && FREE_LOOK[rowDef.tier],
                        isSelected && "border-leaf-600 bg-leaf-600 text-white shadow-md",
                      )}
                    >
                      {isSelected && <Check className="size-4 animate-pop sm:size-5" strokeWidth={3} />}
                      {!taken && !isSelected && <span aria-hidden="true" className="absolute inset-x-1.5 bottom-1 h-1 rounded-full bg-black/10" />}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <ul aria-label="Legend" className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-muted">
          <li className="flex items-center gap-1.5">
            <span className="size-3.5 rounded-sm border-2 border-brand-300 bg-brand-50" /> Available
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-3.5 rounded-sm border-2 border-leaf-600 bg-leaf-600" /> Selected
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-3.5 rounded-sm border-2 border-line bg-[repeating-linear-gradient(135deg,var(--color-line)_0_3px,var(--color-canvas)_3px_6px)]" /> Taken
          </li>
        </ul>

        {/* what choosing a seat looks like */}
        <div className="mt-6 min-h-[4.25rem] border-t border-line pt-5">
          <AnimatePresence mode="wait" initial={false}>
            {selected && row ? (
              <motion.div
                key={selected}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-display text-base font-bold text-ink">
                    Seat {selected} <span className="font-normal text-muted">· {TIERS[row.tier].name}</span>
                  </p>
                  <p className="tabular text-sm font-semibold text-leaf-700">{typeof price === "number" ? formatPerHour(price) : "Live price shown when you book"}</p>
                </div>
                <Link
                  href="/register"
                  className="group inline-flex shrink-0 items-center gap-1.5 rounded-md bg-brand-700 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
                >
                  Book this seat
                  <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              </motion.div>
            ) : (
              <motion.p
                key="hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center gap-2 pt-2 text-sm text-muted"
              >
                <MousePointerClick className="size-4" /> Tap a seat to try it
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
