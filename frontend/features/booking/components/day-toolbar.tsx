"use client";

import { CalendarDays, CalendarRange, Eraser } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { PRESET_LABELS, type PresetKind } from "../lib/selection";
import type { PickMode } from "./date-picker";

interface DayToolbarProps {
  mode: PickMode;
  onModeChange: (mode: PickMode) => void;
  skipWeekends: boolean;
  onSkipWeekendsChange: (value: boolean) => void;
  onPreset: (kind: PresetKind) => void;
  onClear: () => void;
  hasSelection: boolean;
}

const PRESETS: PresetKind[] = ["today", "tomorrow", "next7", "next30"];

export function DayToolbar({ mode, onModeChange, skipWeekends, onSkipWeekendsChange, onPreset, onClear, hasSelection }: DayToolbarProps) {
  return (
    <div className="mb-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <Segmented
          id="pick-mode"
          label="How to choose days"
          value={mode}
          onChange={onModeChange}
          options={[
            {
              value: "range",
              label: (
                <span className="flex items-center gap-2">
                  <CalendarRange className="size-4" /> Date range
                </span>
              ),
            },
            {
              value: "individual",
              label: (
                <span className="flex items-center gap-2">
                  <CalendarDays className="size-4" /> Individual days
                </span>
              ),
            },
          ]}
        />

        <label className="flex cursor-pointer select-none items-center gap-3 text-sm font-medium text-ink">
          <Switch checked={skipWeekends} onCheckedChange={onSkipWeekendsChange} aria-label="Skip weekends" />
          Skip weekends
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-medium text-muted">Quick pick</span>
        {PRESETS.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => onPreset(kind)}
            className="rounded-full border border-line-strong bg-surface px-3.5 py-1.5 text-sm font-semibold text-ink transition-[background-color,border-color,transform,color] hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-none focus-visible:shadow-ring active:scale-95"
          >
            {PRESET_LABELS[kind]}
          </button>
        ))}
        <button
          type="button"
          onClick={onClear}
          disabled={!hasSelection}
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-[opacity,background-color,color]",
            "text-muted hover:bg-danger-50 hover:text-danger-700 focus-visible:outline-none focus-visible:shadow-ring disabled:pointer-events-none disabled:opacity-0",
          )}
        >
          <Eraser className="size-3.5" /> Clear
        </button>
      </div>

      <p className="text-[0.8125rem] text-muted">
        {mode === "range" ? "Click the first day, then the last day. Click the same day twice for a single day." : "Click each day you need. Click a chosen day again to remove it."}
      </p>
    </div>
  );
}
