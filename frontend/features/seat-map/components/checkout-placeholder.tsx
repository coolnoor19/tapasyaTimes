"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, WalletCards } from "lucide-react";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TIERS } from "@/features/landing/content";
import { useIndiaNow } from "@/features/booking/hooks/use-india-now";
import { parseSelectionParams, selectionQuery } from "@/features/booking/lib/selection";
import { formatDateList, formatTimeRange } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { useSeatMap } from "../hooks/use-seat-map";
import { isSelectable } from "../lib/seat-map";

// Stands in for checkout (next phase). It reads the slot, days and seat from the address and looks them up in the
// SAME cached availability the seat map used: so it shows instantly, and proves the hand-over works.
export function CheckoutPlaceholder() {
  const params = useSearchParams();
  const now = useIndiaNow();
  const parsed = useMemo(() => parseSelectionParams(params, now), [params, now]);
  const datesKey = parsed.dates.join(",");
  const dates = useMemo(() => (datesKey ? datesKey.split(",") : []), [datesKey]);

  const query = useSeatMap(parsed.slotId, dates);
  const seat = parsed.seatId && query.data ? (query.data.seatsById[parsed.seatId] ?? null) : null;
  const back = `/book/seats?${selectionQuery(parsed.slotId, dates, parsed.seatId)}`;
  const problem = !parsed.slotId || dates.length === 0 || !parsed.seatId || (query.data && (!seat || !isSelectable(seat)));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Review and pay"
        description="Check your booking, then pay to confirm it."
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href={problem ? "/book" : back}>
              <ArrowLeft className="size-4" />
              Change seat
            </Link>
          </Button>
        }
      />

      {problem ? (
        <Alert tone="warn" title="We can’t find that seat" action={<Button asChild size="sm" variant="secondary"><Link href="/book">Start again</Link></Button>}>
          The seat is no longer free for these days, or the link is incomplete.
        </Alert>
      ) : query.isPending || !query.data || !seat ? (
        <Skeleton className="h-24 rounded-lg" />
      ) : (
        <Card className="animate-fade-up">
          <CardContent className="grid gap-5 sm:grid-cols-3">
            <Detail label="Seat" value={`${seat.seatNumber} · ${TIERS[seat.tier].name} · Floor ${seat.floor}`} />
            <Detail label="Time slot" value={formatTimeRange(query.data.slot.startTime, query.data.slot.endTime)} />
            <Detail label={`${dates.length} ${dates.length === 1 ? "day" : "days"}`} value={formatDateList(dates)} />
            {seat.pricePerDayPaise !== null && (
              <div className="border-t border-line pt-4 sm:col-span-3">
                <p className="tabular text-sm text-muted">
                  {formatRupees(seat.pricePerDayPaise)} × {dates.length} {dates.length === 1 ? "day" : "days"}
                </p>
                <p className="tabular font-display text-2xl font-extrabold text-ink">{formatRupees(seat.pricePerDayPaise * dates.length)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <ComingSoon icon={WalletCards} phase="F5" title="Checkout comes next" description="Your seat will be held for 10 minutes while you pay. Payments are connected in a later step." />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="block text-xs font-medium uppercase tracking-wide text-subtle">{label}</span>
      <span className="tabular font-semibold text-ink">{value}</span>
    </p>
  );
}
