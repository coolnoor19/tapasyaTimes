import type { SeatTier } from "@/features/landing/types";

// How a seat looks for each tier when it is free. Whole class names, so Tailwind can find them.
// (Selected, taken and the other states look the same whatever the tier: they are styled in seat-button.tsx.)
export const FREE_SEAT_LOOK: Record<SeatTier, string> = {
  EXECUTIVE: "border-brand-300 bg-brand-50 text-brand-800 hover:border-tier-executive hover:bg-brand-100",
  PROFESSIONAL: "border-[#a9dde1] bg-[#e6f6f7] text-[#0b6f7a] hover:border-tier-professional hover:bg-[#d3eff1]",
  STUDY: "border-leaf-200 bg-leaf-50 text-leaf-800 hover:border-tier-study hover:bg-leaf-100",
};

// The soft background alone: used for the "taken on some of your days" seat and the legend swatches.
export const SOFT_TIER_FILL: Record<SeatTier, string> = {
  EXECUTIVE: "bg-brand-50",
  PROFESSIONAL: "bg-[#e6f6f7]",
  STUDY: "bg-leaf-50",
};
