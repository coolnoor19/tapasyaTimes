"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Pager } from "@/features/staff/components/pager";
import { QueryProblem } from "@/features/staff/components/query-problem";
import { useSetUrlParams } from "@/features/staff/hooks/use-url-params";
import { parsePage } from "@/features/staff/lib/params";
import { cn } from "@/lib/cn";
import { AUDIT_ACTION_OPTIONS, AUDIT_TARGET_OPTIONS, targetLabel, targetName } from "../lib/audit-format";
import { AUDIT_PAGE_SIZE, useAuditLog } from "../hooks/use-admin-queries";
import type { AuditFilters } from "../types";
import { AuditList } from "./audit-list";
import { emptyBox, selectClass } from "./shared";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KNOWN_ACTIONS = new Set(AUDIT_ACTION_OPTIONS.map((option) => option.value));
const KNOWN_TARGETS = new Set(AUDIT_TARGET_OPTIONS.map((option) => option.value));

// Anything the address holds is checked: an unknown action or a broken id is dropped instead of becoming a 400.
function parseAuditFilters(params: { get(name: string): string | null }): AuditFilters {
  const filters: AuditFilters = {};
  const action = params.get("action") ?? "";
  const targetType = params.get("targetType") ?? "";
  const targetId = (params.get("targetId") ?? "").trim();
  const actorId = params.get("actorId") ?? "";
  if (KNOWN_ACTIONS.has(action)) filters.action = action;
  if (KNOWN_TARGETS.has(targetType)) filters.targetType = targetType;
  if (targetId && targetId.length <= 64 && /^[A-Za-z0-9_-]+$/.test(targetId)) filters.targetId = targetId;
  if (UUID.test(actorId)) filters.actorId = actorId;
  return filters;
}

// Who changed what, newest first. Read-only; the log is written by the backend in the same transaction as each change.
export function AuditScreen() {
  const params = useSearchParams();
  const setParams = useSetUrlParams();
  const filters = parseAuditFilters(params);
  const page = parsePage(params.get("page"));
  const query = useAuditLog(filters, page);
  const data = query.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / AUDIT_PAGE_SIZE)) : 1;
  const hasFilters = Object.keys(filters).length > 0;

  const hrefFor = (target: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) next.set(key, value);
    if (target > 1) next.set("page", String(target));
    const text = next.toString();
    return text ? `/admin/audit-log?${text}` : "/admin/audit-log";
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Audit log" description="Every change an admin made: who, what and when. Newest first." />

      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => event.preventDefault()} role="search" aria-label="Filter the audit log">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          What happened
          <select value={filters.action ?? ""} onChange={(event) => setParams({ action: event.target.value || null, page: null })} className={selectClass}>
            <option value="">Anything</option>
            {AUDIT_ACTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          To what
          <select value={filters.targetType ?? ""} onChange={(event) => setParams({ targetType: event.target.value || null, page: null })} className={selectClass}>
            <option value="">Anything</option>
            {AUDIT_TARGET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </form>

      {(filters.targetId || filters.actorId || hasFilters) && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          {filters.targetId && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-1 pl-3 pr-1.5 text-sm text-brand-800 ring-1 ring-inset ring-brand-200">
              Only {filters.targetType ? targetLabel(filters.targetType).toLowerCase() : "record"} <span className="tabular font-semibold">{targetName(filters.targetType ?? "", filters.targetId)}</span>
              <button type="button" onClick={() => setParams({ targetId: null, page: null })} aria-label="Remove this filter" className="grid size-5 place-items-center rounded-full hover:bg-brand-100">
                <X className="size-3.5" />
              </button>
            </span>
          )}
          {filters.actorId && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-1 pl-3 pr-1.5 text-sm text-brand-800 ring-1 ring-inset ring-brand-200">
              Only one admin’s changes
              <button type="button" onClick={() => setParams({ actorId: null, page: null })} aria-label="Remove this filter" className="grid size-5 place-items-center rounded-full hover:bg-brand-100">
                <X className="size-3.5" />
              </button>
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={() => setParams({ action: null, targetType: null, targetId: null, actorId: null, page: null })}>
            Clear all filters
          </Button>
        </div>
      )}

      {query.isError && !data && <QueryProblem error={query.error} onRetry={() => query.refetch()} retrying={query.isFetching} what="the audit log" />}

      {query.isPending && !query.isError && (
        <div className="flex flex-col gap-3" aria-busy="true">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-20 rounded-lg" />
          ))}
        </div>
      )}

      {data && data.total === 0 && <p className={emptyBox}>{hasFilters ? "No change matches these filters." : "Nothing has been changed yet."}</p>}
      {data && data.total > 0 && data.data.length === 0 && (
        <Alert tone="info" title="That page is empty" action={<Button asChild size="sm" variant="secondary"><Link href={hrefFor(1)}>Go to the first page</Link></Button>} />
      )}

      {data && data.data.length > 0 && (
        <div className={cn("flex flex-col gap-4 transition-opacity", query.isPlaceholderData && "opacity-60")}>
          <AuditList entries={data.data} />
          <Pager page={page} pages={pages} total={data.total} hrefFor={hrefFor} label="Pages of the audit log" />
        </div>
      )}
    </div>
  );
}
