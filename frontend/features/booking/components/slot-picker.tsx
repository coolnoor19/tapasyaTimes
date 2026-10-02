"use client";

import * as RadioGroup from "@radix-ui/react-radio-group";
import { motion } from "motion/react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatTimeRange } from "@/lib/dates";
import { formatDuration, slotMinutes } from "../lib/availability-math";
import type { TimeSlot } from "../types";

// The time slots as selectable cards. A radio group underneath, so arrow keys move between them and a screen
// reader announces "1 of 5". The highlight slides from card to card.
export function SlotPicker({ slots, value, onChange }: { slots: TimeSlot[]; value: string | null; onChange: (slotId: string) => void }) {
  return (
    <RadioGroup.Root value={value ?? ""} onValueChange={onChange} aria-label="Time slot" className="grid grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))] gap-3">
      {slots.map((slot) => {
        const selected = slot.id === value;
        return (
          <RadioGroup.Item
            key={slot.id}
            value={slot.id}
            className={cn(
              "group relative flex flex-col items-start gap-1 rounded-lg border-2 bg-surface px-4 py-3.5 text-left",
              "transition-[border-color,transform,box-shadow] duration-200 active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:shadow-ring",
              selected ? "border-brand-700 shadow-md" : "border-line hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card",
            )}
          >
            {selected && (
              <motion.span
                layoutId="slot-highlight"
                className="absolute inset-0 rounded-[0.4rem] bg-brand-700"
                transition={{ type: "spring", stiffness: 460, damping: 36 }}
              />
            )}
            <span className={cn("relative flex items-center gap-2 whitespace-nowrap text-[0.9375rem] font-bold tabular", selected ? "text-white" : "text-ink")}>
              <Clock className={cn("size-4", selected ? "text-white/80" : "text-brand-600")} aria-hidden="true" />
              {formatTimeRange(slot.startTime, slot.endTime)}
            </span>
            <span className={cn("relative text-xs font-medium", selected ? "text-white/75" : "text-muted")}>{formatDuration(slotMinutes(slot))}</span>
          </RadioGroup.Item>
        );
      })}
    </RadioGroup.Root>
  );
}
