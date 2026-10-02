"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { CalendarX2, Lock } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { addMonths, formatDateList, monthOf, type DateString, type MonthKey } from "@/lib/dates";
import { isApiError } from "@/lib/api/client";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useMonthAvailability, useSelectionAvailability } from "../hooks/use-availability";
import { useIndiaNow } from "../hooks/use-india-now";
import { useTimeSlots } from "../hooks/use-time-slots";
import { dayPriceRange, fullyBookedDays, seatsFreeOnAll } from "../lib/availability-math";
import { isBookableDay, isContiguous, MAX_DATES, parseSelectionParams, presetDates, selectionQuery, type PresetKind } from "../lib/selection";
import { DatePicker, type PickMode, type PickNote } from "./date-picker";
import { DayToolbar } from "./day-toolbar";
import { SelectionSummary, type SummaryStatus } from "./selection-summary";
import { SlotPicker } from "./slot-picker";
import { StepCard } from "./step-card";

interface Note {
  tone: "info" | "warn";
  text: string;
}

// Step 1 of booking: choose a time slot, then the days. The choice lives in the page address
// (/book?slot=...&dates=...), so refreshing, or coming Back from the seat map, keeps it.
export function BookingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const now = useIndiaNow();
  const slotsQuery = useTimeSlots();

  // Read from the address once, when the page opens. Everything in it is checked first.
  const [initial] = useState(() => parseSelectionParams(searchParams, now));
  const [slotId, setSlotId] = useState<string | null>(initial.slotId);
  const [dates, setDates] = useState<DateString[]>(initial.dates);
  const [mode, setMode] = useState<PickMode>(initial.dates.length > 1 && !isContiguous(initial.dates) ? "individual" : "range");
  const [skipWeekends, setSkipWeekends] = useState(false);
  const [month, setMonth] = useState<MonthKey>(monthOf(initial.dates[0] ?? now.date));
  const [note, setNote] = useState<Note | null>(null);
  const [shaking, setShaking] = useState(false);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(shakeTimer.current), []);

  const wide = useMediaQuery("(min-width: 1024px)");
  const visibleMonths = wide ? 2 : 1;

  const slots = slotsQuery.data ?? [];
  const slot = slots.find((candidate) => candidate.id === slotId) ?? null;
  const slotGone = slotsQuery.isSuccess && slotId !== null && slot === null;

  // Days that can no longer be booked (yesterday has passed, or today's slot has just started) drop out by
  // themselves. Worked out from the chosen days, not stored, so it stays right as the clock moves.
  const validDates = useMemo(() => dates.filter((date) => isBookableDay(date, slot?.startTime ?? null, now)), [dates, slot, now]);
  const droppedCount = dates.length - validDates.length;

  // ---- availability ---------------------------------------------------------------------------------
  const monthKeys = useMemo(() => (visibleMonths === 2 ? [month, addMonths(month, 1)] : [month]), [month, visibleMonths]);
  const monthAvailability = useMonthAvailability(slot, monthKeys, now);
  const selection = useSelectionAvailability(slot?.id ?? null, validDates);

  const selectionReady = selection.data !== undefined && !selection.isPlaceholderData;
  const freeSeats = selectionReady && slot ? seatsFreeOnAll(selection.data!.seats, validDates) : null;
  const fullDays = selectionReady ? fullyBookedDays(selection.data!.seats, validDates) : [];
  const priceRange = freeSeats && slot ? dayPriceRange(freeSeats, slot) : null;

  let status: SummaryStatus = "checking";
  let blockedReason = "";
  if (selection.isError && !selection.data) status = "error";
  else if (freeSeats) {
    if (freeSeats.length === 0) {
      status = "blocked";
      blockedReason = fullDays.length > 0 ? "A chosen day is fully booked" : validDates.length === 1 ? "No seat is free that day" : "No single seat is free on all these days";
    } else status = "ready";
  }

  // The address mirrors the choice. (replaceState: Back should leave the page, not step through every click.)
  useEffect(() => {
    const query = selectionQuery(slotId, validDates);
    window.history.replaceState(window.history.state, "", query ? `/book?${query}` : "/book");
  }, [slotId, validDates]);

  // ---- actions -------------------------------------------------------------------------------------
  function chooseSlot(id: string) {
    setSlotId(id);
    setNote(null);
  }

  function changeDates(next: DateString[], info?: PickNote) {
    setDates(next);
    if (info && info.skippedFull.length > 0) setNote({ tone: "info", text: `Skipped fully booked days: ${formatDateList(info.skippedFull)}.` });
    else if (info?.truncated) setNote({ tone: "warn", text: `One booking holds up to ${MAX_DATES} days, so we kept the first ${MAX_DATES}.` });
    else setNote(null);
  }

  function limitReached() {
    toast.info(`You can book up to ${MAX_DATES} days at once.`);
    setShaking(true);
    clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => setShaking(false), 450);
  }

  function applyPreset(kind: PresetKind) {
    const picked = presetDates(kind, {
      slotStartTime: slot?.startTime ?? null,
      now,
      skipWeekends,
      isAllowed: (date) => monthAvailability.freeByDate[date] !== 0,
    });
    if (picked.length === 0) {
      toast.info(kind === "today" ? "Today can’t be booked for this time slot." : "Nothing can be booked for that choice.");
      return;
    }
    setMode("range");
    setDates(picked);
    setMonth(monthOf(picked[0]!));
    setNote(null);
  }

  function removeFullDays() {
    setDates(validDates.filter((date) => !fullDays.includes(date)));
    setNote(null);
  }

  function goToSeats() {
    if (!slot || status !== "ready") return;
    router.push(`/book/seats?${selectionQuery(slot.id, validDates)}`);
  }

  // ---- what to show ---------------------------------------------------------------------------------
  const slotsLoading = slotsQuery.isPending && slotsQuery.fetchStatus !== "idle";
  const noSlots = slotsQuery.isSuccess && slots.length === 0;

  return (
    <div className="flex flex-col gap-6 pb-40 sm:pb-32">
      <PageHeader title="Book a seat" description="Choose a time slot and the days you need. Then pick your exact seat on the next screen." />

      {slotsQuery.isError && (
        <Alert
          tone="danger"
          title="We couldn’t load the time slots"
          action={
            <Button size="sm" variant="secondary" onClick={() => slotsQuery.refetch()} loading={slotsQuery.isFetching}>
              Try again
            </Button>
          }
        >
          {isApiError(slotsQuery.error) && slotsQuery.error.isNetworkError ? "Check your connection and try again." : "Please try again in a moment."}
        </Alert>
      )}

      {noSlots && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <CalendarX2 className="size-6" />
          </span>
          <h2 className="font-display text-lg font-semibold text-ink">No time slots are open yet</h2>
          <p className="max-w-md text-sm text-muted">The workspace hasn’t published its time slots. Please check back soon.</p>
        </div>
      )}

      {!noSlots && !slotsQuery.isError && (
        <>
          <StepCard number={1} title="Choose a time slot" done={slot !== null} hint="You book the same slot on every day you choose.">
            {slotGone && (
              <Alert tone="warn" className="mb-4">
                The time slot in this link is no longer available. Please choose another.
              </Alert>
            )}
            {slotsLoading ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))] gap-3" aria-busy="true" aria-label="Loading time slots">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-[4.25rem] rounded-lg" />
                ))}
              </div>
            ) : (
              <SlotPicker slots={slots} value={slot?.id ?? null} onChange={chooseSlot} />
            )}
          </StepCard>

          <StepCard number={2} title="Choose your days" done={validDates.length > 0} hint="Up to 31 days. Today is available only until the slot starts.">
            {!slot && (
              <p className="mb-5 flex items-center gap-2 rounded-md bg-canvas px-4 py-3 text-sm font-medium text-muted">
                <Lock className="size-4 shrink-0" /> Choose a time slot first, so we can show you which days have seats.
              </p>
            )}

            {/* inert: not clickable and not reachable by keyboard until a slot is chosen */}
            <div inert={!slot} className={slot ? undefined : "select-none opacity-50"}>
              <DayToolbar
                mode={mode}
                onModeChange={setMode}
                skipWeekends={skipWeekends}
                onSkipWeekendsChange={setSkipWeekends}
                onPreset={applyPreset}
                onClear={() => changeDates([])}
                hasSelection={validDates.length > 0}
              />

              <div className={shaking ? "animate-shake" : undefined}>
                <DatePicker
                  slot={slot}
                  now={now}
                  month={month}
                  onMonthChange={setMonth}
                  visibleMonths={visibleMonths}
                  dates={validDates}
                  onDatesChange={changeDates}
                  mode={mode}
                  skipWeekends={skipWeekends}
                  freeByDate={monthAvailability.freeByDate}
                  availabilityLoading={monthAvailability.isLoading}
                  onLimitReached={limitReached}
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 empty:mt-0">
              <AnimatePresence initial={false}>
                {monthAvailability.isError && slot && (
                  <Alert
                    key="avail-error"
                    tone="warn"
                    action={
                      <Button size="sm" variant="secondary" onClick={monthAvailability.refetch}>
                        Try again
                      </Button>
                    }
                  >
                    We couldn’t load how many seats are free each day. You can still choose days, and we’ll check them when you continue.
                  </Alert>
                )}
                {droppedCount > 0 && slot && (
                  <Alert key="dropped" tone="info">
                    {droppedCount === 1 ? "One day was" : `${droppedCount} days were`} removed because {droppedCount === 1 ? "it" : "they"} can no longer be booked for this slot.
                  </Alert>
                )}
                {note && (
                  <Alert key={`note-${note.text}`} tone={note.tone}>
                    {note.text}
                  </Alert>
                )}
                {fullDays.length > 0 && freeSeats && (
                  <Alert
                    key="full-days"
                    tone="warn"
                    action={
                      <Button size="sm" variant="secondary" onClick={removeFullDays}>
                        Remove {fullDays.length === 1 ? "that day" : "those days"}
                      </Button>
                    }
                  >
                    No seats are free on {formatDateList(fullDays)}.
                  </Alert>
                )}
              </AnimatePresence>
            </div>
          </StepCard>
        </>
      )}

      <SelectionSummary
        visible={slot !== null && validDates.length > 0}
        slot={slot}
        dates={validDates}
        status={status}
        freeSeatCount={freeSeats?.length ?? 0}
        priceRange={priceRange}
        blockedReason={blockedReason}
        onContinue={goToSeats}
        onRetry={() => selection.refetch()}
      />
    </div>
  );
}
