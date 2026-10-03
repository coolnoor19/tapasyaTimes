"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, History, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { QueryProblem } from "@/features/staff/components/query-problem";
import { formatTimeRange } from "@/lib/dates";
import { useUpdateTimeSlot } from "../hooks/use-admin-mutations";
import { useAdminTimeSlots } from "../hooks/use-admin-queries";
import { blockingBookings, describeAdminError } from "../lib/errors";
import type { AdminTimeSlot, BlockingBookings } from "../types";
import { SlotFormDialog } from "./slot-form-dialog";
import { BlockedByBookings, ConfirmDialog, emptyBox } from "./shared";

const historyHref = (slot: AdminTimeSlot) => `/admin/audit-log?targetType=TIME_SLOT&targetId=${slot.id}`;

// The blocks of the day customers can book. ONE request loads them all (there are only a handful).
// Switching a slot OFF asks first, because customers can no longer book it; the backend refuses while it still has upcoming
// bookings and says which, and that answer is shown inside the confirmation so the admin sees the reason where they clicked.
export function TimeSlotsScreen() {
  const query = useAdminTimeSlots();
  const slots = query.data;
  const update = useUpdateTimeSlot();

  const [editing, setEditing] = useState<AdminTimeSlot | "new" | null>(null);
  const [turningOff, setTurningOff] = useState<AdminTimeSlot | null>(null);
  const [blocked, setBlocked] = useState<BlockingBookings | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const closeConfirm = () => {
    setTurningOff(null);
    setBlocked(null);
    setProblem(null);
  };

  const switchOn = (slot: AdminTimeSlot) =>
    update.mutate(
      { id: slot.id, patch: { isActive: true } },
      {
        onSuccess: () => toast.success(`${slot.displayName} is on again`),
        onError: (error) => toast.error(describeAdminError(error)), // for example 409: it now overlaps another active slot
      },
    );

  const confirmOff = () => {
    if (!turningOff) return;
    setBlocked(null);
    setProblem(null);
    update.mutate(
      { id: turningOff.id, patch: { isActive: false } },
      {
        onSuccess: () => {
          toast.success(`${turningOff.displayName} is switched off`);
          closeConfirm();
        },
        onError: (error) => {
          const blocking = blockingBookings(error);
          if (blocking) setBlocked(blocking);
          else setProblem(describeAdminError(error));
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Time slots"
        description="The blocks of the day customers can book. Active slots must not overlap."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            Add time slot
          </Button>
        }
      />

      {query.isError && !slots && <QueryProblem error={query.error} onRetry={() => query.refetch()} retrying={query.isFetching} what="the time slots" />}

      {query.isPending && !query.isError && (
        <div className="flex flex-col gap-3" aria-busy="true">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-20 rounded-lg" />
          ))}
        </div>
      )}

      {slots && slots.length === 0 && <p className={emptyBox}>No time slots yet. Customers can’t book until you add one.</p>}

      {slots && slots.length > 0 && (
        <>
          {query.isError && <Alert tone="warn" title="Showing the last list we loaded">We couldn’t refresh it just now.</Alert>}
          {slots.every((slot) => !slot.isActive) && <Alert tone="warn" title="No time slot is on">Customers can’t book anything until one is switched on.</Alert>}

          <ul className="flex flex-col gap-3">
            {slots.map((slot) => {
              const upcoming = slot.upcomingBookings ?? 0;
              return (
                <li key={slot.id} className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700" aria-hidden="true">
                      <Clock className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-display font-bold text-ink">{slot.displayName}</p>
                      <p className="tabular text-sm text-muted">{formatTimeRange(slot.startTime, slot.endTime)}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Badge tone={slot.isActive ? "leaf" : "neutral"}>{slot.isActive ? "On" : "Off"}</Badge>
                        <span className="tabular text-xs text-muted">
                          {upcoming} upcoming {upcoming === 1 ? "booking" : "bookings"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-4">
                    <label className="flex items-center gap-2.5 text-sm font-medium text-ink">
                      <Switch
                        checked={slot.isActive}
                        disabled={update.isPending}
                        aria-label={`${slot.displayName} is ${slot.isActive ? "on" : "off"}`}
                        onCheckedChange={(next) => (next ? switchOn(slot) : setTurningOff(slot))}
                      />
                      <span aria-hidden="true">{slot.isActive ? "On" : "Off"}</span>
                    </label>
                    <Button variant="secondary" size="sm" onClick={() => setEditing(slot)} aria-label={`Edit ${slot.displayName}`}>
                      <Pencil className="size-4" />
                      Edit
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={historyHref(slot)} aria-label={`History of ${slot.displayName}`}>
                        <History className="size-4" />
                        History
                      </Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <SlotFormDialog target={editing} slots={slots ?? []} onClose={() => setEditing(null)} />

      <ConfirmDialog
        open={turningOff !== null}
        onClose={closeConfirm}
        title={`Switch off ${turningOff?.displayName ?? "this slot"}?`}
        description="Customers will no longer be able to book this time. You can switch it on again at any time."
        confirmLabel="Switch off"
        tone="danger"
        loading={update.isPending}
        onConfirm={confirmOff}
        error={
          <>
            {blocked && <BlockedByBookings blocking={blocked} subject={`“${turningOff?.displayName ?? "This slot"}”`} />}
            {problem && <Alert tone="danger">{problem}</Alert>}
          </>
        }
      />
    </div>
  );
}
