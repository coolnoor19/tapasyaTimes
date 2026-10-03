"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiError } from "@/lib/api/client";
import { todayInIndia } from "@/lib/dates";
import { BOOKINGS_PAGE_SIZE, useMyBookings } from "../hooks/use-bookings";
import { useServerNow } from "../hooks/use-server-now";
import { bookingPhase } from "../lib/booking-state";
import { BookingCard } from "./booking-card";

// "?page=3" -> 3. Anything else (missing, 0, "abc", 2.5) -> 1.
const readPage = (value: string | null) => {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
};

export function BookingsList() {
  const page = readPage(useSearchParams().get("page"));
  const query = useMyBookings(page);
  const data = query.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / BOOKINGS_PAGE_SIZE)) : 1;

  // The countdowns tick every second, but only while a hold is actually running.
  const anyHeld = data?.data.some((booking) => booking.status === "PENDING" && booking.expiresAt !== null) ?? false;
  const nowMs = useServerNow(anyHeld ? 1000 : 30_000);
  const today = todayInIndia(new Date(nowMs));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="My bookings"
        description="Your reservations, newest first."
        actions={
          <Button asChild size="sm">
            <Link href="/book">Book a seat</Link>
          </Button>
        }
      />

      {query.isError && !data && (
        <Alert
          tone="danger"
          title="We couldn’t load your bookings"
          action={
            <Button size="sm" variant="secondary" loading={query.isFetching} onClick={() => query.refetch()}>
              Try again
            </Button>
          }
        >
          {isApiError(query.error) && query.error.isNetworkError ? "Check your connection and try again." : "Please try again in a moment."}
        </Alert>
      )}

      {query.isPending && !query.isError && (
        <div className="flex flex-col gap-4" aria-busy="true">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-28 rounded-lg" />
          ))}
        </div>
      )}

      {data && data.total === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-line-strong bg-surface/60 px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
            <CalendarCheck className="size-7" aria-hidden="true" />
          </span>
          <div>
            <p className="font-display text-lg font-bold text-ink">No bookings yet</p>
            <p className="mt-1 text-sm text-muted">Pick a time slot, some days and a seat. It takes about a minute.</p>
          </div>
          <Button asChild>
            <Link href="/book">Book a seat</Link>
          </Button>
        </div>
      )}

      {/* a page number past the end (an old link, or bookings removed) */}
      {data && data.total > 0 && data.data.length === 0 && (
        <Alert tone="info" title="That page is empty" action={<Button asChild size="sm" variant="secondary"><Link href="/bookings">Go to the first page</Link></Button>} />
      )}

      {data && data.data.length > 0 && (
        <>
          <ul className={query.isPlaceholderData ? "flex flex-col gap-4 opacity-60 transition-opacity" : "flex flex-col gap-4"} aria-label="Your bookings">
            {data.data.map((booking) => (
              <BookingCard key={booking.id} booking={booking} phase={bookingPhase(booking, nowMs, today)} nowMs={nowMs} />
            ))}
          </ul>

          {pages > 1 && (
            <nav aria-label="Pages of bookings" className="flex items-center justify-between gap-4">
              <Button asChild variant="secondary" size="sm" className={page <= 1 ? "pointer-events-none opacity-50" : undefined}>
                <Link href={page <= 2 ? "/bookings" : `/bookings?page=${page - 1}`} aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined}>
                  <ArrowLeft className="size-4" />
                  Newer
                </Link>
              </Button>
              <p className="tabular text-sm text-muted">
                Page {Math.min(page, pages)} of {pages}
              </p>
              <Button asChild variant="secondary" size="sm" className={page >= pages ? "pointer-events-none opacity-50" : undefined}>
                <Link href={`/bookings?page=${page + 1}`} aria-disabled={page >= pages} tabIndex={page >= pages ? -1 : undefined}>
                  Older
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
