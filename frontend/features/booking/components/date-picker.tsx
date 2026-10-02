"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DayPicker, type ChevronProps, type DayButtonProps } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  addMonths,
  expandRange,
  formatDay,
  fromPickerDate,
  monthOf,
  toPickerDate,
  type DateString,
  type MonthKey,
} from "@/lib/dates";
import { buildRange, isBookableDay, MAX_MONTHS_AHEAD, toggleDay, type IndiaNow } from "../lib/selection";
import type { TimeSlot } from "../types";

export type PickMode = "range" | "individual";

export interface PickNote {
  skippedFull: DateString[];
  truncated: boolean;
}

interface DatePickerProps {
  slot: TimeSlot | null;
  now: IndiaNow;
  month: MonthKey;
  onMonthChange: (month: MonthKey) => void;
  // 2 on wide screens (easier to drag a range across a month end), 1 on phones
  visibleMonths: 1 | 2;
  dates: DateString[];
  onDatesChange: (dates: DateString[], note?: PickNote) => void;
  mode: PickMode;
  skipWeekends: boolean;
  // How many seats are free on each day (undefined = not loaded yet)
  freeByDate: Record<DateString, number>;
  availabilityLoading: boolean;
  onLimitReached: () => void;
}

// What each day cell needs to draw itself. A context, so the cell component keeps one stable identity
// (a component created inside the calendar would be rebuilt, and lose hover, on every render).
interface CellContextValue {
  freeByDate: Record<DateString, number>;
  loading: boolean;
  slotChosen: boolean;
}
const CellContext = createContext<CellContextValue>({ freeByDate: {}, loading: false, slotChosen: false });

export function DatePicker(props: DatePickerProps) {
  const { slot, now, month, onMonthChange, visibleMonths, dates, onDatesChange, mode, skipWeekends, freeByDate, availabilityLoading, onLimitReached } = props;
  const slotStart = slot?.startTime ?? null;

  // Range mode takes two clicks. The first day is remembered here; while exactly that one day is chosen, the
  // next click closes the range. (Derived from `dates`, so clearing or choosing a preset cancels it by itself.)
  const [anchor, setAnchor] = useState<DateString | null>(null);
  const [hover, setHover] = useState<DateString | null>(null);
  const anchorActive = mode === "range" && anchor !== null && dates.length === 1 && dates[0] === anchor;

  const isFull = (date: DateString) => freeByDate[date] === 0;
  const isAllowed = (date: DateString) => isBookableDay(date, slotStart, now) && !isFull(date);

  const picked = useMemo(() => new Set(dates), [dates]);
  const preview = useMemo(() => {
    if (!anchorActive || !hover) return new Set<DateString>();
    const [from, to] = anchor! <= hover ? [anchor!, hover] : [hover, anchor!];
    return new Set(expandRange(from, to));
  }, [anchorActive, anchor, hover]);

  function handleDayClick(date: DateString) {
    if (!isAllowed(date)) return;

    if (mode === "individual") {
      const result = toggleDay(dates, date);
      if (result.limitReached) onLimitReached();
      else onDatesChange(result.dates);
      return;
    }

    if (anchorActive) {
      const result = buildRange(anchor!, date, { skipWeekends, isAllowed });
      setAnchor(null);
      setHover(null);
      if (result.truncated) onLimitReached();
      onDatesChange(result.dates, { skippedFull: result.skippedFull, truncated: result.truncated });
    } else {
      setAnchor(date);
      onDatesChange([date]);
    }
  }

  const startMonth = monthOf(now.date);

  return (
    <CellContext.Provider value={{ freeByDate, loading: availabilityLoading, slotChosen: slot !== null }}>
      <div onMouseLeave={() => setHover(null)}>
        <DayPicker
          animate
          numberOfMonths={visibleMonths}
          month={toPickerDate(`${month}-01`)}
          onMonthChange={(next) => onMonthChange(monthOf(fromPickerDate(next)))}
          startMonth={toPickerDate(`${startMonth}-01`)}
          endMonth={toPickerDate(`${addMonths(startMonth, MAX_MONTHS_AHEAD)}-01`)}
          today={toPickerDate(now.date)}
          weekStartsOn={1}
          showOutsideDays={false}
          disabled={(date) => !isAllowed(fromPickerDate(date))}
          modifiers={{
            picked: (date) => picked.has(fromPickerDate(date)),
            preview: (date) => preview.has(fromPickerDate(date)),
          }}
          onDayClick={(date) => handleDayClick(fromPickerDate(date))}
          onDayMouseEnter={(date) => setHover(fromPickerDate(date))}
          components={{ DayButton: DayCell, Chevron: NavArrow }}
          classNames={CLASS_NAMES}
        />
      </div>
    </CellContext.Provider>
  );
}

const CLASS_NAMES = {
  root: "relative",
  months: "flex flex-col gap-10 lg:flex-row lg:gap-12",
  month: "min-w-0 flex-1",
  month_caption: "flex h-10 items-center justify-center",
  caption_label: "font-display text-base font-bold text-ink",
  nav: "absolute inset-x-0 top-0 z-10 flex h-10 items-center justify-between",
  button_previous:
    "grid size-9 place-items-center rounded-md text-muted transition-[background-color,color,transform] hover:bg-brand-50 hover:text-brand-800 active:scale-90 disabled:pointer-events-none disabled:opacity-30",
  button_next:
    "grid size-9 place-items-center rounded-md text-muted transition-[background-color,color,transform] hover:bg-brand-50 hover:text-brand-800 active:scale-90 disabled:pointer-events-none disabled:opacity-30",
  month_grid: "mt-3 w-full table-fixed border-separate border-spacing-y-1",
  weekday: "pb-1.5 text-center text-xs font-bold uppercase tracking-wide text-subtle",
  day: "p-0.5 text-center align-middle",
  hidden: "invisible",
};

function NavArrow({ orientation }: ChevronProps) {
  return orientation === "left" ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />;
}

// One day of the calendar: the number, and under it how many seats are free.
function DayCell({ day, modifiers, ...buttonProps }: DayButtonProps) {
  const { freeByDate, loading, slotChosen } = useContext(CellContext);

  // Arrow keys: the calendar marks the next day as "focused"; the button must take the focus itself. (The library's
  // own day button does this. A custom one that forgets it leaves keyboard users stuck on the same day.)
  const button = useRef<HTMLButtonElement>(null);
  const focused = Boolean(modifiers.focused);
  useEffect(() => {
    if (focused) button.current?.focus();
  }, [focused]);

  const date = fromPickerDate(day.date);
  const free = freeByDate[date];
  const picked = Boolean(modifiers.picked);
  const preview = Boolean(modifiers.preview) && !picked;
  const disabled = Boolean(modifiers.disabled);
  const full = free === 0;
  const past = disabled && !full;

  let badge: string | null = null;
  if (slotChosen && !past) badge = full ? "Full" : free === undefined ? null : `${free} left`;

  const description = [
    formatDay(date),
    modifiers.today ? "today" : null,
    picked ? "selected" : null,
    slotChosen && !past ? (full ? "fully booked" : free === undefined ? null : `${free} seat${free === 1 ? "" : "s"} free`) : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      {...buttonProps}
      ref={button}
      aria-pressed={disabled ? undefined : picked}
      aria-label={description}
      className={cn(
        "relative mx-auto flex h-[3.4rem] w-full max-w-[4.25rem] flex-col items-center justify-center gap-0.5 rounded-lg border border-transparent text-sm font-semibold",
        "transition-[background-color,color,transform,border-color,box-shadow] duration-150",
        "focus-visible:outline-none focus-visible:shadow-ring",
        !disabled && !picked && "text-ink hover:border-brand-300 hover:bg-brand-50 active:scale-95",
        modifiers.today && !picked && "border-brand-300",
        preview && "border-brand-200 bg-brand-100 text-brand-800",
        picked && "animate-pop border-brand-700 bg-brand-700 text-white shadow-md",
        past && "cursor-not-allowed text-subtle/45",
        full && "cursor-not-allowed bg-[repeating-linear-gradient(135deg,var(--color-canvas)_0_5px,var(--color-line)_5px_10px)] text-subtle",
      )}
    >
      <span className="tabular leading-none">{day.date.getDate()}</span>
      {badge ? (
        <span
          className={cn(
            "text-[0.625rem] font-semibold leading-none",
            picked ? "text-white/80" : full ? "text-subtle" : free !== undefined && free <= 3 ? "text-warn-600" : "text-leaf-700",
          )}
        >
          {badge}
        </span>
      ) : slotChosen && !past && loading ? (
        <span aria-hidden="true" className="h-1.5 w-6 animate-pulse rounded-full bg-line" />
      ) : (
        <span aria-hidden="true" className="h-[0.625rem]" />
      )}
    </button>
  );
}
