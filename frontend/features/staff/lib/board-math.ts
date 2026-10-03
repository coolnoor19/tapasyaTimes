import { parseSeatNumber } from "@/features/seat-map/lib/seat-map";
import type { Board, BoardSeat, BoardSlot } from "../types";

// Reading the floor board: totals, which slot is "now", how to lay seats out, and the staff search.
// Plain functions of their inputs (the clock is passed in), so they can be checked on their own.

export const fullName = (person: { firstName: string; lastName: string }) => `${person.firstName} ${person.lastName}`.trim();

// One-decimal percent that can never be NaN or above 100.
export const percentOf = (part: number, whole: number) => (whole <= 0 ? 0 : Math.min(100, Math.round((part / whole) * 1000) / 10));

export interface BoardTotals {
  capacity: number;
  booked: number;
  held: number; // booked but not paid yet
  available: number;
  outOfService: number; // seats in maintenance or switched off (counted once, not once per slot)
  occupancyPercent: number;
}

export function boardTotals(board: Board): BoardTotals {
  let capacity = 0;
  let booked = 0;
  let held = 0;
  for (const slot of board.slots) {
    capacity += slot.summary.capacity;
    booked += slot.summary.booked;
    held += slot.seats.filter((seat) => seat.state === "BOOKED" && seat.booking?.itemStatus === "HELD").length;
  }
  const first = board.slots[0];
  const outOfService = first ? first.seats.filter((seat) => seat.state === "MAINTENANCE" || seat.state === "INACTIVE").length : 0;
  return { capacity, booked, held, available: Math.max(0, capacity - booked), outOfService, occupancyPercent: percentOf(booked, capacity) };
}

export type SlotPhase = "now" | "upcoming" | "done" | "other-day";

// Where a slot is in the day. Only meaningful for today's board; on any other day the clock says nothing.
export function slotPhase(slot: BoardSlot["timeSlot"], isToday: boolean, time: string): SlotPhase {
  if (!isToday) return "other-day";
  const now = time.slice(0, 5);
  if (now < slot.startTime) return "upcoming";
  if (now >= slot.endTime) return "done";
  return "now";
}

// The slot to open first: the one under way, else the next one to start, else the last of the day (today);
// the first slot on any other day.
export function defaultSlotId(board: Board, time: string): string | null {
  const slots = board.slots;
  if (slots.length === 0) return null;
  if (!board.isToday) return slots[0]!.timeSlot.id;
  const phases = slots.map((slot) => ({ id: slot.timeSlot.id, phase: slotPhase(slot.timeSlot, true, time) }));
  return (phases.find((p) => p.phase === "now") ?? phases.find((p) => p.phase === "upcoming") ?? phases[phases.length - 1]!).id;
}

export interface SeatRow {
  label: string; // "A", "B"... or "" for seats whose number has no row letter
  seats: BoardSeat[];
}
export interface FloorGroup {
  floor: number;
  rows: SeatRow[];
  seatCount: number;
  bookedCount: number;
}

// Floors -> rows (the letter in "B07") -> seats in column order. Seats without a row letter go in a last, unnamed row.
export function groupByFloor(seats: readonly BoardSeat[]): FloorGroup[] {
  const floors = new Map<number, BoardSeat[]>();
  for (const seat of seats) floors.set(seat.floor, [...(floors.get(seat.floor) ?? []), seat]);

  return [...floors.entries()]
    .sort(([a], [b]) => a - b)
    .map(([floor, floorSeats]) => {
      const rows = new Map<string, { seat: BoardSeat; col: number | null }[]>();
      for (const seat of floorSeats) {
        const { row, col } = parseSeatNumber(seat.seatNumber);
        rows.set(row, [...(rows.get(row) ?? []), { seat, col }]);
      }
      const ordered = [...rows.entries()]
        .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.length - b.length || a.localeCompare(b)))
        .map(([label, items]) => ({
          label,
          seats: items
            .sort((a, b) => (a.col ?? 1e9) - (b.col ?? 1e9) || a.seat.seatNumber.localeCompare(b.seat.seatNumber, undefined, { numeric: true }))
            .map((item) => item.seat),
        }));
      return { floor, rows: ordered, seatCount: floorSeats.length, bookedCount: floorSeats.filter((s) => s.state === "BOOKED").length };
    });
}

// The staff search box: seat number, customer name, phone digits or booking code. Case-insensitive. A blank query
// matches everything (the caller treats blank as "no search").
export function seatMatches(seat: BoardSeat, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") return true;
  if (seat.seatNumber.toLowerCase().includes(q)) return true;
  const booking = seat.booking;
  if (!booking) return false;
  if (booking.bookingCode.toLowerCase().includes(q)) return true;
  if (fullName(booking.customer).toLowerCase().includes(q)) return true;
  const digits = q.replace(/\D/g, "");
  return digits.length >= 3 && booking.customer.phone.replace(/\D/g, "").includes(digits);
}
