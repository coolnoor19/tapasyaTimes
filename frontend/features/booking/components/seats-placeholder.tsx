"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Armchair, CalendarDays, Clock } from "lucide-react";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateList, formatTimeRange } from "@/lib/dates";
import { useIndiaNow } from "../hooks/use-india-now";
import { useTimeSlots } from "../hooks/use-time-slots";
import { parseSelectionParams, selectionQuery } from "../lib/selection";

// Stands in for the seat map (next phase). It already reads and checks the choice made on /book, which proves
// the hand-over works: slot and days arrive intact, and a hand-edited address is caught.
export function SeatsPlaceholder() {
  const now = useIndiaNow();
  const params = useSearchParams();
  const slots = useTimeSlots();
  const { slotId, dates } = parseSelectionParams(params, now);
  const slot = slots.data?.find((candidate) => candidate.id === slotId) ?? null;
  const back = `/book${selectionQuery(slotId, dates) ? `?${selectionQuery(slotId, dates)}` : ""}`;

  const invalid = !slotId || dates.length === 0 || (slots.isSuccess && !slot);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Choose your seat" description="Pick your exact seat on the map." actions={<BackButton href={back} />} />

      {invalid && slots.isSuccess ? (
        <Alert
          tone="warn"
          title="We need a time slot and days first"
          action={
            <Button asChild size="sm" variant="secondary">
              <Link href="/book">Go to booking</Link>
            </Button>
          }
        >
          This link doesn’t contain a valid selection, or part of it is no longer available.
        </Alert>
      ) : slots.isPending ? (
        <Skeleton className="h-24 rounded-lg" />
      ) : (
        slot && (
          <Card className="animate-fade-up">
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-10">
              <p className="flex items-center gap-3 text-ink">
                <span className="grid size-10 place-items-center rounded-lg bg-brand-50 text-brand-700">
                  <Clock className="size-5" />
                </span>
                <span>
                  <span className="block text-xs font-medium uppercase tracking-wide text-subtle">Time slot</span>
                  <span className="tabular font-semibold">
                    {formatTimeRange(slot.startTime, slot.endTime)}
                  </span>
                </span>
              </p>
              <p className="flex items-center gap-3 text-ink">
                <span className="grid size-10 place-items-center rounded-lg bg-leaf-50 text-leaf-700">
                  <CalendarDays className="size-5" />
                </span>
                <span>
                  <span className="block text-xs font-medium uppercase tracking-wide text-subtle">
                    {dates.length} {dates.length === 1 ? "day" : "days"}
                  </span>
                  <span className="tabular font-semibold">{formatDateList(dates)}</span>
                </span>
              </p>
            </CardContent>
          </Card>
        )
      )}

      <ComingSoon icon={Armchair} phase="F4" title="The seat map is next" description="You’ll see every seat, which are free on all your days, and choose yours." />
    </div>
  );
}

function BackButton({ href }: { href: string }) {
  return (
    <Button asChild variant="secondary" size="sm">
      <Link href={href}>
        <ArrowLeft className="size-4" />
        Change slot or days
      </Link>
    </Button>
  );
}
