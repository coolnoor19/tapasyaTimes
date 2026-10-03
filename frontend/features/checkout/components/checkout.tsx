"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Armchair, CalendarDays, Clock, ShieldCheck, Timer } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/lib/api/client";
import { formatDateList, formatDay, formatTimeRange } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { useIndiaNow } from "@/features/booking/hooks/use-india-now";
import { parseSelectionParams, selectionQuery } from "@/features/booking/lib/selection";
import { TIERS } from "@/features/landing/content";
import { useReserveSeat } from "@/features/bookings/hooks/use-bookings";
import { describeReserveError, type ReserveProblem } from "@/features/bookings/lib/errors";
import { HOLD_MINUTES } from "@/features/bookings/lib/booking-state";
import { useSeatMap } from "@/features/seat-map/hooks/use-seat-map";
import { isSelectable, unavailableReason } from "@/features/seat-map/lib/seat-map";

// Step 3 of booking: look it over, then reserve. Pressing the button asks the backend to HOLD the seat on every
// chosen day; that is the moment the countdown starts, on the booking page it leads to.
// What is being booked comes from the page address (slot, days, seat) and is read from the same cached availability
// the seat map used, so the page opens instantly and keeps watching: a seat taken meanwhile is noticed before pressing.
export function Checkout() {
  const router = useRouter();
  const params = useSearchParams();
  const now = useIndiaNow();
  const parsed = useMemo(() => parseSelectionParams(params, now), [params, now]);
  const datesKey = parsed.dates.join(",");
  const dates = useMemo(() => (datesKey ? datesKey.split(",") : []), [datesKey]);

  const { slotId, seatId } = parsed;
  const query = useSeatMap(slotId, dates);
  const map = query.data;
  const seat = seatId && map ? (map.seatsById[seatId] ?? null) : null;
  const canBook = seat !== null && isSelectable(seat) && seat.pricePerDayPaise !== null;

  const reserve = useReserveSeat();
  const [problem, setProblem] = useState<ReserveProblem | null>(null);

  const seatsHref = slotId && dates.length > 0 ? `/book/seats?${selectionQuery(slotId, dates)}` : "/book";
  const daysHref = slotId && dates.length > 0 ? `/book?${selectionQuery(slotId, dates)}` : "/book";
  const incomplete = !slotId || dates.length === 0 || !seatId;
  const selectionProblem = query.isError && isApiError(query.error) && (query.error.status === 400 || query.error.status === 404);

  function submit() {
    if (!seat || !slotId || !canBook || reserve.isPending || reserve.isSuccess) return;
    setProblem(null);
    reserve.mutate(
      { seatId: seat.id, timeSlotId: slotId, dates },
      {
        // replace, not push: Back from the booking should not land on a form whose seat is now yours
        onSuccess: (booking) => router.replace(`/bookings/${booking.id}`),
        onError: (error) => setProblem(describeReserveError(error, seat.seatNumber)),
      },
    );
  }

  const perDay = seat?.pricePerDayPaise ?? null;
  const total = perDay === null ? null : perDay * dates.length;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Review and reserve"
        description="Check your booking, then hold the seat."
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href={incomplete ? "/book" : `/book/seats?${selectionQuery(slotId, dates, seatId)}`}>
              <ArrowLeft className="size-4" />
              Change seat
            </Link>
          </Button>
        }
      />

      {incomplete && (
        <Alert tone="warn" title="This link doesn’t have a full selection" action={<Button asChild size="sm" variant="secondary"><Link href="/book">Start again</Link></Button>}>
          We need a time slot, days and a seat.
        </Alert>
      )}

      {!incomplete && selectionProblem && (
        <Alert tone="warn" title="This selection can’t be booked any more" action={<Button asChild size="sm" variant="secondary"><Link href="/book">Choose again</Link></Button>}>
          {isApiError(query.error) ? query.error.message : "The time slot or one of the days is no longer available."}
        </Alert>
      )}

      {!incomplete && query.isError && !selectionProblem && !map && (
        <Alert
          tone="danger"
          title="We couldn’t load your booking details"
          action={
            <Button size="sm" variant="secondary" loading={query.isFetching} onClick={() => query.refetch()}>
              Try again
            </Button>
          }
        >
          {isApiError(query.error) && query.error.isNetworkError ? "Check your connection and try again." : "Please try again in a moment."}
        </Alert>
      )}

      {!incomplete && map && !seat && (
        <Alert tone="warn" title="We can’t find that seat" action={<Button asChild size="sm" variant="secondary"><Link href={seatsHref}>Choose a seat</Link></Button>}>
          The link may be out of date.
        </Alert>
      )}

      {/* The seat stopped being free: what the backend said when we tried wins, otherwise say why it is not available. */}
      {!incomplete && seat && !canBook && !reserve.isSuccess && (
        <Alert
          tone="warn"
          shake
          title={problem?.title ?? `Seat ${seat.seatNumber} isn’t available`}
          action={<Button asChild size="sm" variant="secondary"><Link href={seatsHref}>Choose another seat</Link></Button>}
        >
          {problem?.message ?? `${unavailableReason(seat, dates.length) || "It can’t be booked right now"}. Please choose another seat.`}
        </Alert>
      )}

      {/* any other failure while the seat is still free: say what happened and let them press the button again */}
      {problem && canBook && (
        <Alert
          tone={problem.tone}
          shake
          title={problem.title}
          action={
            problem.next === "choose-days" ? (
              <Button asChild size="sm" variant="secondary">
                <Link href={daysHref}>Change days or time slot</Link>
              </Button>
            ) : problem.next === "choose-seat" ? (
              <Button asChild size="sm" variant="secondary">
                <Link href={seatsHref}>Choose another seat</Link>
              </Button>
            ) : undefined
          }
        >
          {problem.message}
        </Alert>
      )}

      {!incomplete && !map && !query.isError && <Skeleton className="h-72 rounded-lg" />}

      {map && seat && (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
          <Card className="animate-fade-up">
            <CardContent className="flex flex-col gap-6">
              <div className="grid gap-5 sm:grid-cols-3">
                <Fact icon={<Armchair className="size-5" />} label="Seat">
                  <span>
                    {seat.seatNumber} <span className="font-normal text-muted">· Floor {seat.floor}</span>
                  </span>
                  <Badge tone={seat.tier === "EXECUTIVE" ? "executive" : seat.tier === "PROFESSIONAL" ? "professional" : "study"} className="mt-1 w-fit">
                    {TIERS[seat.tier].name}
                  </Badge>
                </Fact>
                <Fact icon={<Clock className="size-5" />} label="Time slot">
                  {formatTimeRange(map.slot.startTime, map.slot.endTime)}
                </Fact>
                <Fact icon={<CalendarDays className="size-5" />} label={`${dates.length} ${dates.length === 1 ? "day" : "days"}`}>
                  {formatDateList(dates)}
                </Fact>
              </div>

              <details className="group rounded-md border border-line">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-ink focus-visible:outline-none focus-visible:shadow-ring">
                  Every day in this booking
                  <span className="text-xs text-muted group-open:hidden">Show</span>
                  <span className="hidden text-xs text-muted group-open:inline">Hide</span>
                </summary>
                <ul className="divide-y divide-line border-t border-line">
                  {dates.map((date) => (
                    <li key={date} className="tabular flex items-center justify-between gap-4 px-4 py-2 text-sm">
                      <span className="text-ink">{formatDay(date)}</span>
                      <span className="font-medium text-ink">{perDay === null ? "—" : formatRupees(perDay)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </CardContent>
          </Card>

          <Card className="animate-fade-up lg:sticky lg:top-24">
            <CardContent className="flex flex-col gap-5">
              <div>
                {perDay !== null && (
                  <p className="tabular text-sm text-muted">
                    {formatRupees(perDay)} × {dates.length} {dates.length === 1 ? "day" : "days"}
                  </p>
                )}
                <p className="tabular font-display text-3xl font-extrabold text-ink">{total === null ? "Price not set" : formatRupees(total)}</p>
              </div>

              <ul className="flex flex-col gap-3 text-sm text-muted">
                <li className="flex gap-2.5">
                  <Timer className="mt-0.5 size-4 shrink-0 text-warn-600" aria-hidden="true" />
                  <span>
                    Reserving holds the seat for <strong className="font-semibold text-ink">{HOLD_MINUTES} minutes</strong> on every day above. Nobody else can take it meanwhile.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-leaf-600" aria-hidden="true" />
                  <span>The price is worked out by our server when you reserve. Nothing is charged on this step.</span>
                </li>
              </ul>

              <Button size="lg" variant="accent" className="w-full" onClick={submit} loading={reserve.isPending || reserve.isSuccess} disabled={!canBook}>
                {reserve.isSuccess ? "Seat held…" : "Reserve this seat"}
              </Button>
              {reserve.isSuccess && (
                <p role="status" className="text-center text-sm text-leaf-700">
                  Your seat is held. Taking you to your booking…
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Fact({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">{icon}</span>
      <p className="flex min-w-0 flex-col">
        <span className="text-xs font-medium uppercase tracking-wide text-subtle">{label}</span>
        <span className="tabular flex flex-col font-semibold text-ink">{children}</span>
      </p>
    </div>
  );
}
