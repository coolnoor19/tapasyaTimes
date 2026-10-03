"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useServerNow } from "@/features/bookings/hooks/use-server-now";
import { cn } from "@/lib/cn";
import { cleanCode, cleanSearch, filtersToQuery, PAGE_SIZE, parseBookingFilters, parsePage, SEARCH_MIN, STATUS_OPTIONS } from "../lib/params";
import { fullName } from "../lib/board-math";
import { useCustomer, useDebouncedValue, useStaffBookings } from "../hooks/use-staff-queries";
import { useSetUrlParams } from "../hooks/use-url-params";
import { Pager } from "./pager";
import { QueryProblem } from "./query-problem";
import { StaffBookingList } from "./staff-booking-list";

const selectClass =
  "h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-[0.9375rem] text-ink transition-[border-color,box-shadow] hover:border-brand-300 focus-visible:border-brand-500 focus-visible:shadow-ring focus-visible:outline-none";

// Find any booking: by its code, the customer (name, email or phone), its status or a day it covers.
// Filters and the page number live in the address, so a search can be bookmarked or sent to a colleague.
export function BookingsScreen() {
  const params = useSearchParams();
  const setParams = useSetUrlParams();
  const nowMs = useServerNow(30_000);

  const filters = parseBookingFilters(params);
  const page = parsePage(params.get("page"));
  const query = useStaffBookings(filters, page);
  const data = query.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const hasFilters = Object.keys(filters).length > 0;

  // The two text boxes keep what is being typed; the address (and so the request) follows after a short pause.
  const [codeText, setCodeText] = useState(params.get("code") ?? "");
  const [searchText, setSearchText] = useState(params.get("search") ?? "");
  const code = cleanCode(useDebouncedValue(codeText));
  const search = cleanSearch(useDebouncedValue(searchText));
  const typingCode = cleanCode(codeText);
  const typingSearch = cleanSearch(searchText);

  const urlCode = filters.code ?? "";
  const urlSearch = filters.search ?? "";
  useEffect(() => {
    const nextCode = code.value ?? "";
    const nextSearch = search.value ?? "";
    // only write when it changed (and only valid text): a hint-only state (too short, bad code) keeps the old results
    if (code.invalid || search.tooShort) return;
    if (nextCode !== urlCode || nextSearch !== urlSearch) setParams({ code: nextCode || null, search: nextSearch || null, page: null });
  }, [code.value, code.invalid, search.value, search.tooShort, urlCode, urlSearch, setParams]);

  const clearAll = () => {
    setCodeText("");
    setSearchText("");
    setParams({ code: null, search: null, status: null, date: null, customerId: null, page: null });
  };

  const hrefFor = (target: number) => `/manager/bookings${filtersToQuery(filters, target)}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Bookings" description="Look up any booking. Newest first." />

      {/* filters: one row above the results they scope */}
      <form className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" onSubmit={(event) => event.preventDefault()} role="search" aria-label="Filter bookings">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          Booking code
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
            <Input value={codeText} onChange={(event) => setCodeText(event.target.value)} placeholder="TT-ABCD2345" autoComplete="off" spellCheck={false} maxLength={20} className="h-10 pl-9 uppercase placeholder:normal-case" invalid={typingCode.invalid} />
          </div>
          {typingCode.invalid && <span className="text-[0.8125rem] font-normal text-danger-600">A code has only letters, digits and dashes, like TT-ABCD2345.</span>}
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          Customer
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
            <Input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Name, email or phone" autoComplete="off" maxLength={100} className="h-10 pl-9" invalid={typingSearch.tooShort} />
          </div>
          {typingSearch.tooShort && <span className="text-[0.8125rem] font-normal text-warn-600">Type at least {SEARCH_MIN} characters to search.</span>}
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          Status
          <select value={filters.status ?? ""} onChange={(event) => setParams({ status: event.target.value || null, page: null })} className={selectClass}>
            <option value="">Any status</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          Includes the day
          <Input type="date" value={filters.date ?? ""} onChange={(event) => setParams({ date: event.target.value || null, page: null })} className="h-10" />
        </label>
      </form>

      {(hasFilters || filters.customerId) && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          {filters.customerId && <CustomerChip id={filters.customerId} onRemove={() => setParams({ customerId: null, page: null })} />}
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Clear all filters
          </Button>
        </div>
      )}

      {query.isError && !data && <QueryProblem error={query.error} onRetry={() => query.refetch()} retrying={query.isFetching} what="bookings" />}

      {query.isPending && !query.isError && (
        <div className="flex flex-col gap-3" aria-busy="true">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-16 rounded-lg" />
          ))}
        </div>
      )}

      {data && data.total === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center">
          <p className="font-display text-lg font-bold text-ink">{hasFilters ? "No booking matches these filters" : "No bookings yet"}</p>
          <p className="text-sm text-muted">{hasFilters ? "Check the spelling, or try fewer filters." : "They will appear here as customers book."}</p>
          {hasFilters && (
            <Button variant="secondary" size="sm" onClick={clearAll}>
              Clear all filters
            </Button>
          )}
        </div>
      )}

      {data && data.total > 0 && data.data.length === 0 && (
        <Alert tone="info" title="That page is empty" action={<Button asChild size="sm" variant="secondary"><Link href={hrefFor(1)}>Go to the first page</Link></Button>} />
      )}

      {data && data.data.length > 0 && (
        <>
          <StaffBookingList bookings={data.data} nowMs={nowMs} dimmed={query.isPlaceholderData} />
          <div className={cn(query.isPlaceholderData && "opacity-60")}>
            <Pager page={page} pages={pages} total={data.total} hrefFor={hrefFor} label="Pages of bookings" />
          </div>
        </>
      )}
    </div>
  );
}

// "Customer: Asha Rao" with an x, for a list opened from a customer's page.
function CustomerChip({ id, onRemove }: { id: string; onRemove: () => void }) {
  const customer = useCustomer(id);
  const name = customer.data ? fullName(customer.data) : customer.isError ? "unknown customer" : "…";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-1 pl-3 pr-1.5 text-sm font-medium text-brand-800 ring-1 ring-inset ring-brand-200">
      Customer: {name}
      <button type="button" aria-label="Remove the customer filter" onClick={onRemove} className="grid size-5 place-items-center rounded-full hover:bg-brand-100">
        <X className="size-3.5" />
      </button>
    </span>
  );
}
