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
import { Segmented } from "@/components/ui/segmented";
import { TIERS } from "@/features/landing/content";
import type { SeatTier } from "@/features/landing/types";
import { useCreateSeat, useUpdateSeat } from "../hooks/use-admin-mutations";
import { blockingBookings, conflictField, describeAdminError } from "../lib/errors";
import { seatFormSchema, type SeatFormOutput, type SeatFormValues } from "../schemas/admin-schemas";
import type { AdminSeat, BlockingBookings, SeatStatus } from "../types";
import { BlockedByBookings } from "./shared";

const TIER_OPTIONS = (["EXECUTIVE", "PROFESSIONAL", "STUDY"] as const).map((tier) => ({ value: tier, label: TIERS[tier].name }));
const STATUS_OPTIONS: { value: SeatStatus; label: string }[] = [
  { value: "AVAILABLE", label: "Available" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "INACTIVE", label: "Switched off" },
];

// Add a seat (target "new") or change one. The form is mounted only while the dialog is open and is keyed by the seat,
// so reopening always starts from the seat's current values.
export function SeatFormDialog({ target, onClose }: { target: AdminSeat | "new" | null; onClose: () => void }) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>{target !== null && <SeatForm key={target === "new" ? "new" : target.id} seat={target === "new" ? null : target} onDone={onClose} />}</DialogContent>
    </Dialog>
  );
}

function SeatForm({ seat, onDone }: { seat: AdminSeat | null; onDone: () => void }) {
  const create = useCreateSeat();
  const update = useUpdateSeat();
  const [blocked, setBlocked] = useState<BlockingBookings | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors, isDirty },
  } = useForm<SeatFormValues, unknown, SeatFormOutput>({
    resolver: zodResolver(seatFormSchema),
    defaultValues: { seatNumber: seat?.seatNumber ?? "", seatType: seat?.seatType ?? "EXECUTIVE", floor: seat?.floor ?? 1, status: seat?.status ?? "AVAILABLE" },
    mode: "onTouched",
  });

  const busy = create.isPending || update.isPending;
  const tier = useWatch({ control, name: "seatType" });
  const status = useWatch({ control, name: "status" });

  const failed = (error: unknown) => {
    const blocking = blockingBookings(error);
    if (blocking) return setBlocked(blocking);
    const conflict = conflictField(error);
    if (conflict?.field === "seatNumber") return setError("seatNumber", { message: conflict.message }, { shouldFocus: true });
    setProblem(describeAdminError(error));
  };

  const submit = handleSubmit((values) => {
    setBlocked(null);
    setProblem(null);

    if (!seat) {
      create.mutate(
        { seatNumber: values.seatNumber, seatType: values.seatType, floor: values.floor },
        {
          onSuccess: (saved) => {
            toast.success(`Seat ${saved.seatNumber} added`);
            onDone();
          },
          onError: failed,
        },
      );
      return;
    }

    // Only what really changed is sent: nothing to say = no request, and the audit log stays free of empty entries.
    const patch: Parameters<typeof update.mutate>[0]["patch"] = {};
    if (values.seatNumber !== seat.seatNumber) patch.seatNumber = values.seatNumber;
    if (values.seatType !== seat.seatType) patch.seatType = values.seatType;
    if (values.floor !== seat.floor) patch.floor = values.floor;
    if (values.status !== seat.status) patch.status = values.status;
    if (Object.keys(patch).length === 0) return onDone();

    update.mutate(
      { id: seat.id, patch },
      {
        onSuccess: (saved) => {
          toast.success(`Seat ${saved.seatNumber} saved`);
          onDone();
        },
        onError: failed,
      },
    );
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div>
        <DialogTitle>{seat ? `Seat ${seat.seatNumber}` : "Add a seat"}</DialogTitle>
        <DialogDescription>{seat ? "Change the details of this seat." : "A new seat is offered to customers as soon as its tier has a price."}</DialogDescription>
      </div>

      {blocked && <BlockedByBookings blocking={blocked} subject={`Seat ${seat?.seatNumber ?? ""}`.trim()} />}
      {problem && <Alert tone="danger">{problem}</Alert>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Seat number" error={errors.seatNumber?.message} hint="Like A07. Letters are saved in capitals.">
          {({ invalid, ...control }) => <Input autoComplete="off" spellCheck={false} maxLength={10} className="uppercase" invalid={invalid} {...control} {...register("seatNumber")} />}
        </Field>
        <Field label="Floor" error={errors.floor?.message} hint="0 is the ground floor.">
          {({ invalid, ...control }) => <Input type="number" inputMode="numeric" min={0} max={100} invalid={invalid} {...control} {...register("floor", { valueAsNumber: true })} />}
        </Field>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-ink" id="seat-tier-label">
          Tier
        </span>
        <Segmented<SeatTier> id="seat-tier" label="Tier" value={tier} options={TIER_OPTIONS} onChange={(value) => setValue("seatType", value, { shouldDirty: true })} className="self-start max-sm:w-full max-sm:[&>button]:flex-1" />
        <p className="text-[0.8125rem] text-muted">The tier decides the price. Changing it does not alter bookings that already exist; they keep the price they were sold at.</p>
      </div>

      {seat && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Status</span>
          <Segmented<SeatStatus> id="seat-status" label="Status" value={status} options={STATUS_OPTIONS} onChange={(value) => setValue("status", value, { shouldDirty: true })} className="self-start max-sm:w-full max-sm:[&>button]:flex-1" />
          <p className="text-[0.8125rem] text-muted">Maintenance and switched off both hide the seat from customers. This is refused while the seat has upcoming bookings.</p>
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy} disabled={Boolean(seat) && !isDirty}>
          {seat ? "Save changes" : "Add seat"}
        </Button>
      </div>
    </form>
  );
}
