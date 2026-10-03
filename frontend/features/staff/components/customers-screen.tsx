"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { formatDayWithYear, nowInIndia } from "@/lib/dates";
import { cleanSearch, PAGE_SIZE, parsePage, SEARCH_MIN } from "../lib/params";
import { fullName } from "../lib/board-math";
import { useCustomers, useDebouncedValue } from "../hooks/use-staff-queries";
import { useSetUrlParams } from "../hooks/use-url-params";
import type { Customer } from "../types";
import { Pager } from "./pager";
import { QueryProblem } from "./query-problem";

export const joinedOn = (iso: string): string => {
  const created = new Date(iso);
  return Number.isNaN(created.getTime()) ? "" : formatDayWithYear(nowInIndia(created).date);
};

export function CustomerBadges({ customer }: { customer: Pick<Customer, "isVerified" | "status"> }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge tone={customer.isVerified ? "leaf" : "warn"}>{customer.isVerified ? "Email verified" : "Not verified"}</Badge>
      {customer.status === "SUSPENDED" && <Badge tone="danger">Suspended</Badge>}
    </span>
  );
}

// Customers (ordinary accounts; staff accounts are not listed). Search by name, email or phone.
export function CustomersScreen() {
  const params = useSearchParams();
  const setParams = useSetUrlParams();
  const page = parsePage(params.get("page"));
  const urlSearch = cleanSearch(params.get("search") ?? "").value;

  const [text, setText] = useState(params.get("search") ?? "");
  const typing = cleanSearch(text);
  const settled = cleanSearch(useDebouncedValue(text));

  useEffect(() => {
    if (settled.tooShort) return; // too short: keep the current results, the hint explains
    if ((settled.value ?? "") !== (urlSearch ?? "")) setParams({ search: settled.value ?? null, page: null });
  }, [settled.value, settled.tooShort, urlSearch, setParams]);

  const query = useCustomers(urlSearch, page);
  const data = query.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const hrefFor = (target: number) => `/manager/customers?${new URLSearchParams({ ...(urlSearch ? { search: urlSearch } : {}), ...(target > 1 ? { page: String(target) } : {}) }).toString()}`.replace(/\?$/, "");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Customers" description="Find a customer to see their details and bookings." />

      <div className="max-w-xl">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          Search
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
            <Input type="search" value={text} onChange={(event) => setText(event.target.value)} placeholder="Name, email or phone" autoComplete="off" maxLength={100} className="h-11 pl-9" invalid={typing.tooShort} />
          </div>
          {typing.tooShort && <span className="text-[0.8125rem] font-normal text-warn-600">Type at least {SEARCH_MIN} characters to search.</span>}
        </label>
      </div>

      {query.isError && !data && <QueryProblem error={query.error} onRetry={() => query.refetch()} retrying={query.isFetching} what="customers" />}

      {query.isPending && !query.isError && (
        <div className="flex flex-col gap-3" aria-busy="true">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-16 rounded-lg" />
          ))}
        </div>
      )}

      {data && data.total === 0 && (
        <p className="rounded-lg border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center text-sm text-muted">
          {urlSearch ? `No customer matches “${urlSearch}”.` : "No customers have signed up yet."}
        </p>
      )}

      {data && data.total > 0 && data.data.length === 0 && (
        <Alert tone="info" title="That page is empty" action={<Button asChild size="sm" variant="secondary"><Link href={hrefFor(1)}>Go to the first page</Link></Button>} />
      )}

      {data && data.data.length > 0 && (
        <div className={cn("flex flex-col gap-4 transition-opacity", query.isPlaceholderData && "opacity-60")}>
          <div className="hidden overflow-hidden rounded-lg border border-line bg-surface shadow-card md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-canvas/60 text-xs uppercase tracking-wide text-subtle">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Customer</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Contact</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Account</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Bookings</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.data.map((customer) => (
                  <tr key={customer.id} className="transition-colors hover:bg-brand-50/40">
                    <td className="max-w-56 px-4 py-3.5">
                      <Link href={`/manager/customers/${customer.id}`} className="block truncate font-semibold text-brand-700 hover:text-brand-800 hover:underline">
                        {fullName(customer)}
                      </Link>
                    </td>
                    <td className="max-w-64 px-4 py-3.5 text-muted">
                      <span className="block truncate">{customer.email}</span>
                      <span className="tabular text-xs">{customer.phone}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <CustomerBadges customer={customer} />
                    </td>
                    <td className="tabular px-4 py-3.5 text-right font-semibold text-ink">{customer.bookingCount}</td>
                    <td className="tabular px-4 py-3.5 text-muted">{joinedOn(customer.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-3 md:hidden">
            {data.data.map((customer) => (
              <li key={customer.id}>
                <Link href={`/manager/customers/${customer.id}`} className="block rounded-lg border border-line bg-surface p-4 shadow-card">
                  <p className="truncate font-display font-bold text-ink">{fullName(customer)}</p>
                  <p className="truncate text-sm text-muted">{customer.email}</p>
                  <p className="tabular text-sm text-muted">{customer.phone}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <CustomerBadges customer={customer} />
                    <span className="tabular text-xs text-muted">
                      {customer.bookingCount} {customer.bookingCount === 1 ? "booking" : "bookings"}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <Pager page={page} pages={pages} total={data.total} hrefFor={hrefFor} label="Pages of customers" />
        </div>
      )}
    </div>
  );
}
