"use client";

import type { ReactNode } from "react";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode }[];
  label: string;
  // Needed when two segmented controls are on one page, so their sliding highlights do not mix
  id: string;
  className?: string;
}

// A row of choices where exactly one is on, with a highlight that slides to the new choice.
export function Segmented<T extends string>({ value, onChange, options, label, id, className }: SegmentedProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      // Radix reports "" when the active item is clicked again; a segmented control always keeps one chosen
      onValueChange={(next) => next && onChange(next as T)}
      aria-label={label}
      className={cn("relative inline-flex rounded-lg bg-canvas p-1 ring-1 ring-inset ring-line", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <ToggleGroup.Item
            key={option.value}
            value={option.value}
            className={cn(
              "relative rounded-md px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:shadow-ring",
              active ? "text-brand-800" : "text-muted hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId={`segmented-${id}`}
                className="absolute inset-0 rounded-md bg-surface shadow-sm ring-1 ring-line"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{option.label}</span>
          </ToggleGroup.Item>
        );
      })}
    </ToggleGroup.Root>
  );
}
