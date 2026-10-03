"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatTimeRange } from "@/lib/dates";
import { useCreateTimeSlot, useUpdateTimeSlot } from "../hooks/use-admin-mutations";
import { blockingBookings, conflictField, describeAdminError } from "../lib/errors";
import { findOverlap, minutesBetween } from "../lib/slot-math";
import { slotFormSchema, type SlotFormOutput, type SlotFormValues } from "../schemas/admin-schemas";
import type { AdminTimeSlot, BlockingBookings } from "../types";
import { BlockedByBookings } from "./shared";

// Add a time slot (target "new") or change one's name and times. Switching a slot on or off is done in the list.
// `slots` is the list already on screen: it lets the form warn about an overlap before anything is sent.
export function SlotFormDialog({ target, slots, onClose }: { target: AdminTimeSlot | "new" | null; slots: readonly AdminTimeSlot[]; onClose: () => void }) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>{target !== null && <SlotForm key={target === "new" ? "new" : target.id} slot={target === "new" ? null : target} slots={slots} onDone={onClose} />}</DialogContent>
    </Dialog>
  );
}

function SlotForm({ slot, slots, onDone }: { slot: AdminTimeSlot | null; slots: readonly AdminTimeSlot[]; onDone: () => void }) {
  const create = useCreateTimeSlot();
  const update = useUpdateTimeSlot();
  const [blocked, setBlocked] = useState<BlockingBookings | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isDirty },
  } = useForm<SlotFormValues, unknown, SlotFormOutput>({
    resolver: zodResolver(slotFormSchema),
    defaultValues: { startTime: slot?.startTime ?? "", endTime: slot?.endTime ?? "", displayName: slot?.displayName ?? "" },
    mode: "onTouched",
  });

  const busy = create.isPending || update.isPending;
  const start = useWatch({ control, name: "startTime" });
  const end = useWatch({ control, name: "endTime" });

  // A new slot is always active; an existing one only has to avoid others while it is active itself.
  const overlap = !slot || slot.isActive ? findOverlap(slots, start, end, slot?.id) : undefined;
  const length = start && end && end > start ? minutesBetween(start, end) : null;

  const failed = (error: unknown) => {
    const blocking = blockingBookings(error);
    if (blocking) return setBlocked(blocking);
    const conflict = conflictField(error);
    if (conflict && conflict.field !== "seatNumber") return setError(conflict.field, { message: conflict.message }, { shouldFocus: true });
    setProblem(describeAdminError(error));
  };

  const submit = handleSubmit((values) => {
    setBlocked(null);
    setProblem(null);

    if (!slot) {
      create.mutate(
        { startTime: values.startTime, endTime: values.endTime, ...(values.displayName ? { displayName: values.displayName } : {}) },
        {
          onSuccess: (saved) => {
            toast.success(`${saved.displayName} added`);
            onDone();
          },
          onError: failed,
        },
      );
      return;
    }

    if (!values.displayName) return setError("displayName", { message: "Enter a name" }, { shouldFocus: true });
    const patch: Parameters<typeof update.mutate>[0]["patch"] = {};
    if (values.startTime !== slot.startTime) patch.startTime = values.startTime;
    if (values.endTime !== slot.endTime) patch.endTime = values.endTime;
    if (values.displayName !== slot.displayName) patch.displayName = values.displayName;
    if (Object.keys(patch).length === 0) return onDone();

    update.mutate(
      { id: slot.id, patch },
      {
        onSuccess: (saved) => {
          toast.success(`${saved.displayName} saved`);
          onDone();
        },
        onError: failed,
      },
    );
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div>
        <DialogTitle>{slot ? "Change time slot" : "Add a time slot"}</DialogTitle>
        <DialogDescription>
          {slot
            ? "Changing the times is refused while the slot has upcoming bookings."
            : "A time slot is one block of the day customers can book, such as 9:00 – 10:00 AM. Active slots must not overlap."}
        </DialogDescription>
      </div>

      {blocked && <BlockedByBookings blocking={blocked} subject={`“${slot?.displayName ?? "This slot"}”`} />}
      {problem && <Alert tone="danger">{problem}</Alert>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Starts" error={errors.startTime?.message}>
          {({ invalid, ...control }) => <Input type="time" step={60} invalid={invalid} {...control} {...register("startTime")} />}
        </Field>
        <Field label="Ends" error={errors.endTime?.message}>
          {({ invalid, ...control }) => <Input type="time" step={60} invalid={invalid} {...control} {...register("endTime")} />}
        </Field>
      </div>

      {length !== null && (
        <p className="-mt-2 text-[0.8125rem] text-muted">
          {formatTimeRange(start, end)} · {length >= 60 && length % 60 === 0 ? `${length / 60} ${length === 60 ? "hour" : "hours"}` : `${length} minutes`}
        </p>
      )}

      {overlap && (
        <Alert tone="warn" title="This overlaps another slot">
          “{overlap.displayName}” already runs {formatTimeRange(overlap.startTime, overlap.endTime)}. Active slots must not overlap, so saving will be refused.
        </Alert>
      )}

      <Field label="Name" error={errors.displayName?.message} hint={slot ? undefined : "Optional. Leave it empty to use the times, like 09:00 - 10:00."}>
        {({ invalid, ...control }) => <Input autoComplete="off" maxLength={50} placeholder={slot ? undefined : "Morning"} invalid={invalid} {...control} {...register("displayName")} />}
      </Field>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy} disabled={Boolean(slot) && !isDirty}>
          {slot ? "Save changes" : "Add time slot"}
        </Button>
      </div>
    </form>
  );
}
