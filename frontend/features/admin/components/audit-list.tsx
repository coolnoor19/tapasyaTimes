"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { actionLabel, describeChanges, formatWhen, targetHref, targetLabel, targetName } from "../lib/audit-format";
import type { AuditEntry } from "../types";

// One line per change: when, who, what, and the fields that changed as "Status: Available → Maintenance".
// Shared by the audit log screen and a person's page.
export function AuditList({ entries, showTarget = true }: { entries: readonly AuditEntry[]; showTarget?: boolean }) {
  return (
    <ol className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface shadow-card">
      {entries.map((entry) => {
        const changes = describeChanges(entry.before, entry.after);
        const href = targetHref(entry.targetType, entry.targetId);
        return (
          <li key={entry.id} className="flex flex-col gap-2.5 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">{actionLabel(entry.action)}</Badge>
                {showTarget && (
                  <span className="text-sm text-muted">
                    {targetLabel(entry.targetType)}{" "}
                    {href ? (
                      <Link href={href} className="tabular font-semibold text-brand-700 hover:text-brand-800 hover:underline" title={entry.targetId}>
                        {targetName(entry.targetType, entry.targetId)}
                      </Link>
                    ) : (
                      <span className="tabular font-semibold text-ink" title={entry.targetId}>
                        {targetName(entry.targetType, entry.targetId)}
                      </span>
                    )}
                  </span>
                )}
              </div>
              <time dateTime={entry.createdAt} className="tabular text-xs text-subtle">
                {formatWhen(entry.createdAt)}
              </time>
            </div>

            {changes.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {changes.map((change) => (
                  <li key={change.field} className="inline-flex items-center gap-1.5 rounded-md bg-canvas px-2.5 py-1 text-[0.8125rem] text-muted ring-1 ring-inset ring-line">
                    <span className="font-medium text-ink">{change.label}</span>
                    {change.from !== null && (
                      <>
                        <span>{change.from}</span>
                        <ArrowRight className="size-3 text-subtle" aria-label="changed to" />
                      </>
                    )}
                    <span className="font-semibold text-ink">{change.to}</span>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-xs text-subtle">
              By{" "}
              {entry.actor ? (
                <span className="font-medium text-muted" title={entry.actor.email ?? undefined}>
                  {entry.actor.name || entry.actor.email || "an admin"}
                </span>
              ) : (
                "a removed account"
              )}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
