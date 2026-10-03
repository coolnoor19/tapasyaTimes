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
import { joinedOn } from "@/features/staff/components/customers-screen";
import { Pager } from "@/features/staff/components/pager";
import { QueryProblem } from "@/features/staff/components/query-problem";
import { useDebouncedValue } from "@/features/staff/hooks/use-staff-queries";
import { useSetUrlParams } from "@/features/staff/hooks/use-url-params";
import { cleanSearch, parsePage, SEARCH_MIN } from "@/features/staff/lib/params";
import { fullName } from "@/features/staff/lib/board-math";
import { cn } from "@/lib/cn";
import { ADMIN_PAGE_SIZE, useAdminUsers } from "../hooks/use-admin-queries";
import type { AdminUser, UserFilters } from "../types";
import { emptyBox, selectClass } from "./shared";

export const ROLE_LABEL: Record<AdminUser["role"], string> = { ADMIN: "Admin", MANAGER: "Manager", USER: "Customer" };

export function UserBadges({ user }: { user: Pick<AdminUser, "role" | "status" | "isVerified" | "isLocked"> }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge tone={user.role === "ADMIN" ? "brand" : user.role === "MANAGER" ? "professional" : "neutral"}>{ROLE_LABEL[user.role]}</Badge>
      {user.status === "SUSPENDED" && <Badge tone="danger">Suspended</Badge>}
      {!user.isVerified && <Badge tone="warn">Not verified</Badge>}
      {user.isLocked && <Badge tone="warn">Locked out</Badge>}
    </span>
  );
}

const ROLES = new Set(["ADMIN", "MANAGER", "USER"]);
const STATUSES = new Set(["ACTIVE", "SUSPENDED"]);

function parseUserFilters(params: { get(name: string): string | null }): UserFilters {
  const filters: UserFilters = {};
  const search = cleanSearch(params.get("search") ?? "").value;
  const role = params.get("role") ?? "";
  const status = params.get("status") ?? "";
  const verified = params.get("verified") ?? "";
  if (search) filters.search = search;
  if (ROLES.has(role)) filters.role = role as UserFilters["role"];
  if (STATUSES.has(status)) filters.status = status as UserFilters["status"];
  if (verified === "true" || verified === "false") filters.isVerified = verified;
  return filters;
}

// Every account: customers, managers and admins. Searching and filtering happen on the server (there can be many
// accounts), so typing waits for a pause and a search shorter than 2 characters is never sent.
export function UsersScreen() {
  const params = useSearchParams();
  const setParams = useSetUrlParams();
  const filters = parseUserFilters(params);
  const page = parsePage(params.get("page"));
  const query = useAdminUsers(filters, page);
  const data = query.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / ADMIN_PAGE_SIZE)) : 1;
  const hasFilters = Object.keys(filters).length > 0;

  const [text, setText] = useState(params.get("search") ?? "");
  const typing = cleanSearch(text);
  const settled = cleanSearch(useDebouncedValue(text));
  useEffect(() => {
    if (settled.tooShort) return; // too short: keep the current rows, the hint explains
    if ((settled.value ?? "") !== (filters.search ?? "")) setParams({ search: settled.value ?? null, page: null });
  }, [settled.value, settled.tooShort, filters.search, setParams]);

  const hrefFor = (target: number) => {
    const next = new URLSearchParams();
    if (filters.search) next.set("search", filters.search);
    if (filters.role) next.set("role", filters.role);
    if (filters.status) next.set("status", filters.status);
    if (filters.isVerified) next.set("verified", filters.isVerified);
    if (target > 1) next.set("page", String(target));
    const queryText = next.toString();
    return queryText ? `/admin/users?${queryText}` : "/admin/users";
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Users and roles" description="Find an account to suspend it or make someone a manager. Admin accounts can’t be changed here." />

      <form className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" onSubmit={(event) => event.preventDefault()} role="search" aria-label="Filter users">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          Search
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
            <Input type="search" value={text} onChange={(event) => setText(event.target.value)} placeholder="Name, email or phone" autoComplete="off" maxLength={100} className="h-10 pl-9" invalid={typing.tooShort} />
          </div>
          {typing.tooShort && <span className="text-[0.8125rem] font-normal text-warn-600">Type at least {SEARCH_MIN} characters to search.</span>}
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          Role
          <select value={filters.role ?? ""} onChange={(event) => setParams({ role: event.target.value || null, page: null })} className={selectClass}>
            <option value="">Any role</option>
            <option value="USER">Customer</option>
            <option value="MANAGER">Manager</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          Account
          <select value={filters.status ?? ""} onChange={(event) => setParams({ status: event.target.value || null, page: null })} className={selectClass}>
            <option value="">Any</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          Email
          <select value={filters.isVerified ?? ""} onChange={(event) => setParams({ verified: event.target.value || null, page: null })} className={selectClass}>
            <option value="">Any</option>
            <option value="true">Verified</option>
            <option value="false">Not verified</option>
          </select>
        </label>
      </form>

      {hasFilters && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setText("");
              setParams({ search: null, role: null, status: null, verified: null, page: null });
            }}
          >
            Clear all filters
          </Button>
        </div>
      )}

      {query.isError && !data && <QueryProblem error={query.error} onRetry={() => query.refetch()} retrying={query.isFetching} what="the users" />}

      {query.isPending && !query.isError && (
        <div className="flex flex-col gap-3" aria-busy="true">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-16 rounded-lg" />
          ))}
        </div>
      )}

      {data && data.total === 0 && <p className={emptyBox}>{hasFilters ? "No account matches these filters." : "There are no accounts yet."}</p>}
      {data && data.total > 0 && data.data.length === 0 && (
        <Alert tone="info" title="That page is empty" action={<Button asChild size="sm" variant="secondary"><Link href={hrefFor(1)}>Go to the first page</Link></Button>} />
      )}

      {data && data.data.length > 0 && (
        <div className={cn("flex flex-col gap-4 transition-opacity", query.isPlaceholderData && "opacity-60")}>
          <div className="hidden overflow-hidden rounded-lg border border-line bg-surface shadow-card md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Users</caption>
              <thead className="border-b border-line bg-canvas/60 text-xs uppercase tracking-wide text-subtle">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Person</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Contact</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Account</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.data.map((user) => (
                  <tr key={user.id} className="transition-colors hover:bg-brand-50/40">
                    <td className="max-w-56 px-4 py-3.5">
                      <Link href={`/admin/users/${user.id}`} className="block truncate font-semibold text-brand-700 hover:text-brand-800 hover:underline">
                        {fullName(user)}
                      </Link>
                    </td>
                    <td className="max-w-64 px-4 py-3.5 text-muted">
                      <span className="block truncate">{user.email}</span>
                      <span className="tabular text-xs">{user.phone}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <UserBadges user={user} />
                    </td>
                    <td className="tabular px-4 py-3.5 text-muted">{joinedOn(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-3 md:hidden">
            {data.data.map((user) => (
              <li key={user.id}>
                <Link href={`/admin/users/${user.id}`} className="block rounded-lg border border-line bg-surface p-4 shadow-card">
                  <p className="truncate font-display font-bold text-ink">{fullName(user)}</p>
                  <p className="truncate text-sm text-muted">{user.email}</p>
                  <p className="tabular text-sm text-muted">{user.phone}</p>
                  <div className="mt-3">
                    <UserBadges user={user} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <Pager page={page} pages={pages} total={data.total} hrefFor={hrefFor} label="Pages of users" />
        </div>
      )}
    </div>
  );
}
