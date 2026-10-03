"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Mail, Phone } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useServerNow } from "@/features/bookings/hooks/use-server-now";
import { fullName } from "../lib/board-math";
import { useCustomer } from "../hooks/use-staff-queries";
import { CustomerBadges, joinedOn } from "./customers-screen";
import { isNotFound, QueryProblem } from "./query-problem";
import { StaffBookingList } from "./staff-booking-list";

// One customer: how to reach them, their account state, and their latest bookings.
export function CustomerDetail({ id }: { id: string }) {
  const query = useCustomer(id);
  const nowMs = useServerNow(30_000);
  const customer = query.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={customer ? fullName(customer) : "Customer"}
        description={customer ? `Joined ${joinedOn(customer.createdAt)}` : undefined}
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/manager/customers">
              <ArrowLeft className="size-4" />
              All customers
            </Link>
          </Button>
        }
      />

      {query.isError && isNotFound(query.error) && (
        <Alert tone="warn" title="We can’t find that customer" action={<Button asChild size="sm" variant="secondary"><Link href="/manager/customers">Search customers</Link></Button>}>
          The link may be wrong, or this is not a customer account.
        </Alert>
      )}
      {query.isError && !isNotFound(query.error) && !customer && <QueryProblem error={query.error} onRetry={() => query.refetch()} retrying={query.isFetching} what="this customer" />}
      {query.isPending && !query.isError && (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-36 rounded-lg" />
          <Skeleton className="h-56 rounded-lg" />
        </div>
      )}

      {customer && (
        <>
          <Card>
            <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 flex-col gap-3">
                <CustomerBadges customer={customer} />
                <ul className="flex flex-col gap-2 text-sm">
                  <li>
                    <a href={`tel:${customer.phone}`} className="tabular flex items-center gap-2 text-brand-700 hover:text-brand-800 hover:underline">
                      <Phone className="size-4 shrink-0" aria-hidden="true" />
                      {customer.phone}
                    </a>
                  </li>
                  <li className="min-w-0">
                    <a href={`mailto:${customer.email}`} className="flex items-center gap-2 text-brand-700 hover:text-brand-800 hover:underline">
                      <Mail className="size-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{customer.email}</span>
                    </a>
                  </li>
                </ul>
              </div>
              <div className="sm:text-right">
                <p className="text-sm text-muted">Bookings</p>
                <p className="tabular font-display text-3xl font-bold text-ink">{customer.bookingCount}</p>
              </div>
            </CardContent>
          </Card>

          <section aria-labelledby="customer-bookings" className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <h2 id="customer-bookings" className="text-lg font-bold text-ink">
                Latest bookings
              </h2>
              {customer.bookingCount > customer.recentBookings.length && (
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/manager/bookings?customerId=${customer.id}`}>
                    See all {customer.bookingCount}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              )}
            </div>
            {customer.recentBookings.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line-strong bg-surface/60 px-6 py-10 text-center text-sm text-muted">This customer has not booked yet.</p>
            ) : (
              <StaffBookingList bookings={customer.recentBookings} nowMs={nowMs} hideCustomer />
            )}
          </section>
        </>
      )}
    </div>
  );
}
