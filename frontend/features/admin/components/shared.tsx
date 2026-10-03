"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatDay } from "@/lib/dates";
import type { BlockingBookings } from "../types";

export const selectClass =
  "h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-[0.9375rem] text-ink transition-[border-color,box-shadow] hover:border-brand-300 focus-visible:border-brand-500 focus-visible:shadow-ring focus-visible:outline-none";

// The loading shape of a table: same height rows, so nothing jumps when the data arrives.
export const emptyBox = "rounded-lg border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center text-sm text-muted";

// "This seat has 3 upcoming bookings": the change was refused, and these are the bookings in the way.
// Nothing is cancelled for the admin; each code links to the booking so they can deal with it first.
export function BlockedByBookings({ blocking, subject }: { blocking: BlockingBookings; subject: string }) {
  return (
    <Alert tone="warn" title={`${subject} has ${blocking.total} upcoming ${blocking.total === 1 ? "booking" : "bookings"}`}>
      <p>That change would affect customers who already booked, so it was not made. Deal with these bookings first:</p>
      <ul className="mt-2 flex flex-col gap-1">
        {blocking.bookings.map((booking) => (
          <li key={`${booking.bookingCode}-${booking.date}`} className="flex flex-wrap items-center gap-x-2 text-[0.8125rem]">
            <Link href={`/manager/bookings?code=${encodeURIComponent(booking.bookingCode)}`} className="tabular inline-flex items-center gap-0.5 font-semibold underline underline-offset-2">
              {booking.bookingCode}
              <ArrowUpRight className="size-3" aria-hidden="true" />
            </Link>
            <span>
              {formatDay(booking.date)} · {booking.timeSlot} · seat {booking.seatNumber}
            </span>
          </li>
        ))}
      </ul>
      {blocking.total > blocking.bookings.length && <p className="mt-1.5 text-[0.8125rem]">…and {blocking.total - blocking.bookings.length} more.</p>}
    </Alert>
  );
}

// "Are you sure?" for changes that affect people. The dialog stays open while the request runs and shows a refusal inside
// it, so the admin reads the reason where they clicked.
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  tone = "primary",
  loading,
  error,
  onConfirm,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  loading: boolean;
  error?: ReactNode;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !loading && onClose()}>
      <DialogContent>
        <div className="flex flex-col gap-5">
          <div>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </div>
          {children}
          {error}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button variant={tone === "danger" ? "danger" : "primary"} loading={loading} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
