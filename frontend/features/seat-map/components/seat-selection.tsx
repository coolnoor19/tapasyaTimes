"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, CalendarDays, Clock, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { isApiError } from "@/lib/api/client";
import { formatDateList, formatTimeRange } from "@/lib/dates";
import { useIndiaNow } from "@/features/booking/hooks/use-india-now";
import { parseSelectionParams, selectionQuery } from "@/features/booking/lib/selection";
import { useSeatMap } from "../hooks/use-seat-map";
import { isSelectable, unavailableReason, type MapSeat } from "../lib/seat-map";
import { SeatLegend } from "./seat-legend";
import { SeatMapSkeleton } from "./seat-map-skeleton";
import { SeatMapView } from "./seat-map-view";
import { SeatSelectionBar } from "./seat-selection-bar";

// Step 2 of booking: pick one seat. Everything about WHAT is being booked (slot and days) is read from the page
// address, checked, and used to ask for availability: normally answered straight from the cache, because the
// previous screen already asked the same question.
export function SeatSelection() {
  const router = useRouter();
  const params = useSearchParams();
  const now = useIndiaNow();

  const parsed = useMemo(() => parseSelectionParams(params, now), [params, now]);
  const slotId = parsed.slotId;
  // Same days -> same array, so the data layer sees "nothing changed" and the map does not rebuild.
  const datesKey = parsed.dates.join(",");
  const dates = useMemo(() => (datesKey ? datesKey.split(",") : []), [datesKey]);

  const query = useSeatMap(slotId, dates);
  const map = query.data;

  const [selectedId, setSelectedId] = useState<string | null>(parsed.seatId);
  const [floorChoice, setFloorChoice] = useState<number | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  // ---- what is selected, worked out from the map (never stored twice) ------------------------------------
  const selectedSeat = selectedId && map ? (map.seatsById[selectedId] ?? null) : null;
  const pickedSeat = selectedSeat && isSelectable(selectedSeat) ? selectedSeat : null;
  // The chosen seat is gone: someone booked it meanwhile, or the address named a seat that is not free.
  const lostSeat = map && selectedId && !pickedSeat ? { id: selectedId, number: selectedSeat?.seatNumber ?? null, reason: selectedSeat ? unavailableReason(selectedSeat, dates.length) : "" } : null;

  const floors = map?.floors ?? [];
  const activeFloor =
    floors.find((floor) => floor.floor === floorChoice) ??
    floors.find((floor) => floor.floor === pickedSeat?.floor) ??
    floors.find((floor) => floor.freeCount > 0) ??
    floors[0] ??
    null;

  // The single seat that Tab lands on: the one last used, else the chosen one, else the first free one.
  const tabbableId = useMemo(() => {
    if (!activeFloor) return null;
    const seats = activeFloor.sections.flatMap((section) => section.rows.flatMap((row) => row.cells.filter((cell): cell is MapSeat => cell !== null)));
    return (
      seats.find((seat) => seat.id === focusId)?.id ?? seats.find((seat) => seat.id === pickedSeat?.id)?.id ?? seats.find(isSelectable)?.id ?? seats[0]?.id ?? null
    );
  }, [activeFloor, focusId, pickedSeat?.id]);

  // ---- actions ------------------------------------------------------------------------------------------------
  // Stable functions: the seats are memoised, and a new function each render would repaint all of them.
  const pick = useCallback((seat: MapSeat) => {
    setSelectedId((current) => (current === seat.id ? null : seat.id));
    setFocusId(seat.id);
  }, []);
  const rememberFocus = useCallback((id: string) => setFocusId(id), []);

  // The address mirrors the chosen seat, so a refresh keeps it. (replaceState: Back leaves the page.)
  useEffect(() => {
    if (!slotId || dates.length === 0) return;
    window.history.replaceState(window.history.state, "", `/book/seats?${selectionQuery(slotId, dates, pickedSeat?.id ?? null)}`);
  }, [slotId, dates, pickedSeat?.id]);

  // A seat that WAS yours and is taken while you look: say so clearly, once.
  const hadSeat = useRef<string | null>(null);
  const pickedId = pickedSeat?.id ?? null;
  const lostId = lostSeat?.id ?? null;
  const lostNumber = lostSeat?.number ?? null;
  useEffect(() => {
    if (pickedId) hadSeat.current = pickedId;
    else if (lostId && hadSeat.current === lostId) {
      toast.warning(lostNumber ? `Seat ${lostNumber} was just taken` : "Your seat was just taken", { description: "Please choose another seat." });
      hadSeat.current = null;
    }
  }, [pickedId, lostId, lostNumber]);

  const checkoutQuery = slotId && pickedSeat ? selectionQuery(slotId, dates, pickedSeat.id) : "";
  const goToCheckout = () => checkoutQuery && router.push(`/book/checkout?${checkoutQuery}`);
  // Reaching for "Continue" starts loading the next screen's code, so the click feels instant.
  const warmCheckout = () => router.prefetch("/book/checkout");

  const backHref = `/book${selectionQuery(slotId, dates) ? `?${selectionQuery(slotId, dates)}` : ""}`;
  const invalid = !slotId || dates.length === 0;
  const coldLoading = query.isPending && query.fetchStatus !== "idle";
  const selectionProblem = query.isError && isApiError(query.error) && (query.error.status === 400 || query.error.status === 404);

  return (
    <div className="flex flex-col gap-6 pb-36 sm:pb-32">
      <PageHeader
        title="Choose your seat"
        description="Pick the seat you want. It will be yours on every day you chose."
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href={invalid ? "/book" : backHref}>
              <ArrowLeft className="size-4" />
              Change slot or days
            </Link>
          </Button>
        }
      />

      {invalid && (
        <Alert
          tone="warn"
          title="We need a time slot and days first"
          action={
            <Button asChild size="sm" variant="secondary">
              <Link href="/book">Go to booking</Link>
            </Button>
          }
        >
          This link doesn’t contain a valid selection.
        </Alert>
      )}

      {!invalid && selectionProblem && (
        <Alert
          tone="warn"
          title="This selection can’t be booked any more"
          action={
            <Button asChild size="sm" variant="secondary">
              <Link href="/book">Choose again</Link>
            </Button>
          }
        >
          {isApiError(query.error) ? query.error.message : "The time slot or one of the days is no longer available."}
        </Alert>
      )}

      {!invalid && query.isError && !selectionProblem && !map && (
        <Alert
          tone="danger"
          title="We couldn’t load the seats"
          action={
            <Button size="sm" variant="secondary" loading={query.isFetching} onClick={() => query.refetch()}>
              Try again
            </Button>
          }
        >
          {isApiError(query.error) && query.error.isNetworkError ? "Check your connection and try again." : "Please try again in a moment."}
        </Alert>
      )}

      {map && (
        <Card className="animate-fade-up">
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-10 sm:gap-y-3">
            <Fact icon={<Clock className="size-5" />} tone="brand" label="Time slot" value={formatTimeRange(map.slot.startTime, map.slot.endTime)} />
            <Fact
              icon={<CalendarDays className="size-5" />}
              tone="leaf"
              label={`${dates.length} ${dates.length === 1 ? "day" : "days"}`}
              value={formatDateList(dates)}
            />
            <p className="ml-auto flex items-center gap-2 text-sm text-muted" aria-live="polite">
              <LiveDot fetching={query.isFetching} />
              <span>
                <strong className="font-semibold text-leaf-700">{map.freeCount}</strong> of {map.seatCount} seats free on all your days
              </span>
            </p>
          </CardContent>
        </Card>
      )}

      <AnimatePresence initial={false}>
        {lostSeat && (
          <Alert key={`lost-${lostSeat.id}`} tone="warn" shake title={lostSeat.number ? `Seat ${lostSeat.number} isn’t available` : "That seat isn’t available"}>
            {lostSeat.reason ? `${lostSeat.reason}. ` : ""}Please choose another seat.
          </Alert>
        )}
        {map && map.seatCount > 0 && map.freeCount === 0 && (
          <Alert
            key="none-free"
            tone="warn"
            title="No seat is free on all your days"
            action={
              <Button asChild size="sm" variant="secondary">
                <Link href={backHref}>Change days or time slot</Link>
              </Button>
            }
          >
            Every seat is taken on at least one of the days you chose. Try fewer days, other days, or a different time slot.
          </Alert>
        )}
      </AnimatePresence>

      {coldLoading && !invalid && (
        <Card>
          <CardContent className="py-10">
            <SeatMapSkeleton />
          </CardContent>
        </Card>
      )}

      {map && map.seatCount === 0 && (
        <p className="rounded-lg border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center text-muted">No seats have been set up yet. Please check back soon.</p>
      )}

      {map && activeFloor && (
        <Card className="animate-fade-up">
          <CardContent className="flex flex-col gap-7">
            {floors.length > 1 && (
              <div className="flex justify-center">
                <Segmented
                  id="floor"
                  label="Floor"
                  value={String(activeFloor.floor)}
                  onChange={(value) => setFloorChoice(Number(value))}
                  options={floors.map((floor) => ({
                    value: String(floor.floor),
                    label: (
                      <span className="flex items-center gap-2">
                        Floor {floor.floor}
                        <span className="text-xs font-medium text-muted">{floor.freeCount} free</span>
                        {pickedSeat?.floor === floor.floor && <span aria-label="Your seat is on this floor" className="size-2 rounded-full bg-leaf-500" />}
                      </span>
                    ),
                  }))}
                />
              </div>
            )}

            {/* a quick cross-fade when the floor changes */}
            <motion.div key={activeFloor.floor} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
              <SeatMapView floor={activeFloor} selectedId={pickedSeat?.id ?? null} tabbableId={tabbableId} daysChosen={dates.length} onPick={pick} onFocusSeat={rememberFocus} />
            </motion.div>

            <SeatLegend className="border-t border-line pt-6" />
          </CardContent>
        </Card>
      )}

      <SeatSelectionBar seat={pickedSeat} daysChosen={dates.length} onContinue={goToCheckout} onClear={() => setSelectedId(null)} onIntent={warmCheckout} />
    </div>
  );
}

function Fact({ icon, tone, label, value }: { icon: React.ReactNode; tone: "brand" | "leaf"; label: string; value: string }) {
  return (
    <p className="flex items-center gap-3 text-ink">
      <span className={tone === "brand" ? "grid size-10 place-items-center rounded-lg bg-brand-50 text-brand-700" : "grid size-10 place-items-center rounded-lg bg-leaf-50 text-leaf-700"}>{icon}</span>
      <span>
        <span className="block text-xs font-medium uppercase tracking-wide text-subtle">{label}</span>
        <span className="tabular font-semibold">{value}</span>
      </span>
    </p>
  );
}

// A small pulsing dot: the seats refresh by themselves. Turns into a spinner icon while a refresh is running.
function LiveDot({ fetching }: { fetching: boolean }) {
  return fetching ? (
    <RotateCw aria-label="Refreshing" className="size-3.5 animate-spin text-brand-600" />
  ) : (
    <span aria-label="Live" className="relative flex size-2.5">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-leaf-400 opacity-60 [animation-duration:2.4s]" />
      <span className="relative inline-flex size-2.5 rounded-full bg-leaf-500" />
    </span>
  );
}
