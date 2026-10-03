"use client";

import Link from "next/link";
import { Armchair, Ban, Phone, Timer, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useServerNow } from "@/features/bookings/hooks/use-server-now";
import { formatCountdown } from "@/features/bookings/lib/booking-state";
import { TIERS } from "@/features/landing/content";
import { formatDay } from "@/lib/dates";
import { fullName } from "../lib/board-math";
import type { BoardSeat } from "../types";

const tierTone = (tier: BoardSeat["seatType"]) => (tier === "EXECUTIVE" ? "executive" : tier === "PROFESSIONAL" ? "professional" : "study");

// Everything staff need to know about one seat on one day and slot: who has it, how to reach them, and whether they paid.
// `returnFocusId` is the seat that opened the dialog: when it closes, keyboard focus goes back to that seat tile (there is no
// trigger element for the dialog to remember, because it is opened from one of hundreds of tiles).
export function SeatDialog({ seat, date, slotLabel, onClose, returnFocusId }: { seat: BoardSeat | null; date: string; slotLabel: string; onClose: () => void; returnFocusId: string | null }) {
  return (
    <Dialog open={seat !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (returnFocusId) document.querySelector<HTMLElement>(`[data-seat-id="${returnFocusId}"]`)?.focus();
        }}
      >
        {seat && <SeatDetails seat={seat} date={date} slotLabel={slotLabel} />}
      </DialogContent>
    </Dialog>
  );
}

function SeatDetails({ seat, date, slotLabel }: { seat: BoardSeat; date: string; slotLabel: string }) {
  const nowMs = useServerNow();
  const booking = seat.booking;
  const holdLeft = booking?.holdExpiresAt ? Date.parse(booking.holdExpiresAt) - nowMs : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700" aria-hidden="true">
          <Armchair className="size-5" />
        </span>
        <div className="min-w-0">
          <DialogTitle>Seat {seat.seatNumber}</DialogTitle>
          <DialogDescription>
            {formatDay(date)} · {slotLabel}
          </DialogDescription>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={tierTone(seat.seatType)}>{TIERS[seat.seatType].name}</Badge>
            <span className="text-xs text-muted">Floor {seat.floor}</span>
          </div>
        </div>
      </div>

      {seat.state === "AVAILABLE" && <p className="rounded-md bg-leaf-50 px-4 py-3 text-sm text-leaf-800">This seat is free for this slot.</p>}

      {seat.state === "MAINTENANCE" && (
        <p className="flex items-start gap-2.5 rounded-md bg-danger-50 px-4 py-3 text-sm text-danger-700">
          <Wrench className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          This seat is out of service for maintenance.
        </p>
      )}
      {seat.state === "INACTIVE" && (
        <p className="flex items-start gap-2.5 rounded-md bg-canvas px-4 py-3 text-sm text-muted ring-1 ring-inset ring-line">
          <Ban className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          This seat is switched off and not offered to customers.
        </p>
      )}

      {booking && (
        <div className="flex flex-col gap-4 rounded-lg border border-line p-4">
          {seat.state !== "BOOKED" && <p className="text-xs font-medium text-warn-600">The seat is out of service but still has this booking. Someone should contact the customer.</p>}

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-subtle">Customer</p>
            <Link href={`/manager/customers/${booking.customer.id}`} className="font-semibold text-ink hover:underline">
              {fullName(booking.customer)}
            </Link>
            <a href={`tel:${booking.customer.phone}`} className="tabular mt-0.5 flex w-fit items-center gap-1.5 text-sm text-brand-700 hover:text-brand-800 hover:underline">
              <Phone className="size-3.5" aria-hidden="true" />
              {booking.customer.phone}
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-subtle">Booking</p>
              <Link href={`/manager/bookings/${booking.id}`} className="tabular font-semibold text-brand-700 hover:text-brand-800 hover:underline">
                {booking.bookingCode}
              </Link>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-subtle">Payment</p>
              {booking.itemStatus === "CONFIRMED" ? (
                <Badge tone="leaf">Paid</Badge>
              ) : (
                <span className="flex items-center gap-2">
                  <Badge tone="warn">
                    <Timer className="size-3" aria-hidden="true" />
                    Unpaid, held
                  </Badge>
                  {holdLeft !== null && holdLeft > 0 && <span className="tabular text-xs text-warn-600">{formatCountdown(holdLeft)} left</span>}
                  {holdLeft !== null && holdLeft <= 0 && <span className="text-xs text-subtle">hold just ended</span>}
                </span>
              )}
            </div>
          </div>

          <Button asChild variant="secondary" size="sm" className="w-fit">
            <Link href={`/manager/bookings/${booking.id}`}>Open the booking</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
