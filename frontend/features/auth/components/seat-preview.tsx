"use client";

import { motion } from "motion/react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

// A small, decorative preview of the seat map the customer will use: three tiers, a few seats taken, one picked.
// It exists to show what the product is the moment someone lands on the sign-in page. Purely visual.

type SeatState = "free" | "taken" | "picked";

const ROWS: { tier: string; seat: string; seats: SeatState[] }[] = [
  { tier: "Executive", seat: "bg-brand-300", seats: ["free", "taken", "free", "picked", "free", "taken"] },
  { tier: "Professional", seat: "bg-[#5ccfd9]", seats: ["taken", "free", "free", "free", "taken", "free"] },
  { tier: "Study", seat: "bg-leaf-300", seats: ["free", "free", "taken", "free", "free", "free"] },
];

const EASE = [0.16, 1, 0.3, 1] as const;

export function SeatPreview() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-sm select-none">
      {/* the reception desk, where a cinema would have its screen */}
      <motion.div
        initial={{ opacity: 0, scaleX: 0.6 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.8, ease: EASE }}
        className="mx-auto mb-7 w-4/5"
      >
        <svg viewBox="0 0 320 34" className="w-full overflow-visible">
          <defs>
            <linearGradient id="reception-glow" x1="0" x2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0.9" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M4 28 Q160 -8 316 28" fill="none" stroke="url(#reception-glow)" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <p className="-mt-1 text-center text-[0.625rem] font-semibold uppercase tracking-[0.3em] text-white/50">Reception</p>
      </motion.div>

      <div className="flex flex-col gap-4">
        {ROWS.map((row, rowIndex) => (
          <div key={row.tier} className="flex items-center gap-3">
            <span className="w-4 text-center text-xs font-semibold text-white/45">{"ABC"[rowIndex]}</span>
            <div className="grid flex-1 grid-cols-6 gap-2.5">
              {row.seats.map((state, seatIndex) => (
                <motion.span
                  key={seatIndex}
                  initial={{ opacity: 0, scale: 0.4, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.25 + rowIndex * 0.12 + seatIndex * 0.05, duration: 0.5, ease: EASE }}
                  className={cn(
                    "relative grid h-9 place-items-center rounded-t-[0.7rem] rounded-b-md",
                    state === "free" && row.seat,
                    state === "taken" && "bg-white/12 ring-1 ring-inset ring-white/10",
                    state === "picked" && "bg-leaf-400 text-white",
                  )}
                >
                  {/* the little cushion line of a seat */}
                  {state !== "picked" && <span className={cn("absolute inset-x-1.5 bottom-1 h-1 rounded-full", state === "taken" ? "bg-white/10" : "bg-white/35")} />}
                  {state === "picked" && (
                    <>
                      <Check className="size-4" strokeWidth={3} />
                      <motion.span
                        className="absolute -inset-1 rounded-t-[0.9rem] rounded-b-lg border-2 border-leaf-300"
                        animate={{ opacity: [0.9, 0, 0.9], scale: [1, 1.18, 1] }}
                        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 1.4 }}
                      />
                    </>
                  )}
                </motion.span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* what picking a seat looks like */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1, duration: 0.6, ease: EASE }}
        className="mt-8"
      >
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          className="mx-auto flex w-fit items-center gap-3 rounded-full bg-white/95 py-2 pl-2.5 pr-4 text-sm font-semibold text-ink shadow-pop"
        >
          <span className="grid size-6 place-items-center rounded-full bg-leaf-500 text-white">
            <Check className="size-3.5" strokeWidth={3.5} />
          </span>
          Seat A4 · Executive
        </motion.div>
      </motion.div>
    </div>
  );
}
