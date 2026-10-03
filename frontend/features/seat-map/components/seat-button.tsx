"use client";

import { memo } from "react";
import { Ban, Check, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TIERS } from "@/features/landing/content";
import { cn } from "@/lib/cn";
import { formatRupees } from "@/lib/money";
import { FREE_SEAT_LOOK, SOFT_TIER_FILL } from "../lib/seat-look";
import { isSelectable, seatAriaLabel, unavailableReason, type MapSeat } from "../lib/seat-map";

interface SeatButtonProps {
  seat: MapSeat;
  selected: boolean;
  // Only ONE seat on the map is a tab stop (arrow keys move between the others), so Tab does not crawl through 100 seats
  tabbable: boolean;
  daysChosen: number;
  // staggers the entrance (milliseconds)
  enterDelay: number;
  onPick: (seat: MapSeat) => void;
  onFocusSeat: (seatId: string) => void;
}

const BASE =
  "group relative grid size-11 shrink-0 place-items-center rounded-t-[0.95rem] rounded-b-lg border-2 text-[0.8125rem] font-bold tabular " +
  "transition-[transform,background-color,border-color,box-shadow,color] duration-150 sm:size-12 focus-visible:outline-none focus-visible:shadow-ring";

const BLOCKED = "cursor-not-allowed";

// memo: picking a seat repaints only the seat that was chosen and the one that was un-chosen, not the whole map.
export const SeatButton = memo(function SeatButton({ seat, selected, tabbable, daysChosen, enterDelay, onPick, onFocusSeat }: SeatButtonProps) {
  const selectable = isSelectable(seat);
  const tierName = TIERS[seat.tier].name;
  const reason = unavailableReason(seat, daysChosen);

  function handleClick() {
    if (selectable) onPick(seat);
    // A seat that cannot be picked still answers a tap: touch screens have no hover, so say why.
    else toast.info(`Seat ${seat.seatNumber}: ${reason}`);
  }

  const look = selected
    ? "animate-pop border-leaf-600 bg-leaf-600 text-white shadow-lg"
    : {
        available: cn(FREE_SEAT_LOOK[seat.tier], "cursor-pointer hover:-translate-y-0.5 hover:scale-105 hover:shadow-md active:scale-95"),
        taken: cn(BLOCKED, "border-line bg-[repeating-linear-gradient(135deg,var(--color-line)_0_4px,var(--color-canvas)_4px_8px)] text-subtle/60"),
        partial: cn(BLOCKED, "border-dashed border-line-strong text-subtle", SOFT_TIER_FILL[seat.tier]),
        maintenance: cn(BLOCKED, "border-warn-600/30 bg-warn-50 text-warn-600"),
        unpriced: cn(BLOCKED, "border-warn-600/30 bg-warn-50 text-warn-600"),
        inactive: cn(BLOCKED, "border-line bg-canvas text-subtle/60"),
      }[seat.state];

  return (
    // The entrance sits on a wrapper so it can never fight with the selection "pop" on the button itself.
    <span className="animate-fade-up" style={{ animationDelay: `${enterDelay}ms` }}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-seat-id={seat.id}
            aria-label={seatAriaLabel(seat, tierName, daysChosen, selected)}
            aria-pressed={selectable ? selected : undefined}
            aria-disabled={selectable ? undefined : true}
            tabIndex={tabbable ? 0 : -1}
            onClick={handleClick}
            onFocus={() => onFocusSeat(seat.id)}
            className={cn(BASE, look)}
          >
            {selected && (
              <span aria-hidden="true" className="pointer-events-none absolute -inset-1 animate-pulse-ring rounded-t-[1.15rem] rounded-b-xl border-2 border-leaf-400" />
            )}
            {selected ? (
              <Check className="size-5" strokeWidth={3} />
            ) : seat.state === "maintenance" || seat.state === "unpriced" ? (
              <Wrench className="size-4" />
            ) : seat.state === "inactive" ? (
              <Ban className="size-4" />
            ) : (
              <span className="max-w-full truncate px-0.5">{seat.label}</span>
            )}
            {/* the little cushion line of a free seat */}
            {!selected && seat.state === "available" && <span aria-hidden="true" className="absolute inset-x-1.5 bottom-1 h-1 rounded-full bg-black/10" />}
            {/* a diagonal slash: this seat is taken on SOME of your days */}
            {!selected && seat.state === "partial" && (
              <span aria-hidden="true" className="absolute inset-0 rounded-[inherit] bg-[linear-gradient(135deg,transparent_46%,var(--color-line-strong)_46%_54%,transparent_54%)]" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent className="text-left">
          <p className="font-semibold">
            Seat {seat.seatNumber} · {tierName}
          </p>
          <p className="text-white/65">Floor {seat.floor}</p>
          <p className={cn("mt-1 font-medium", selectable || selected ? "text-leaf-300" : "text-warn-50")}>
            {selected ? "Selected" : selectable ? (seat.pricePerDayPaise === null ? "Available" : `${formatRupees(seat.pricePerDayPaise)} per day`) : reason}
          </p>
        </TooltipContent>
      </Tooltip>
    </span>
  );
});
