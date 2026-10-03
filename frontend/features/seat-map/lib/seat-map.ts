import { pricePerDayPaise } from "@/features/booking/lib/availability-math";
import type { AvailabilityResult, SeatAvailability, TimeSlot } from "@/features/booking/types";
import type { SeatTier } from "@/features/landing/types";
import { formatDateList, type DateString } from "@/lib/dates";
import { formatRupees } from "@/lib/money";

// Turns the backend's list of seats into a floor plan: floors -> tier sections -> rows -> seats.
// All plain functions (no screen, no clock), so the layout rules can be checked on their own.
//
// There is no stored layout yet, so rows and columns are READ FROM THE SEAT NUMBER: "B07" is row B, column 7.
// Seats whose numbers do not follow that pattern ("WINDOW-1") are placed in plain rows at the end of their section.

export type SeatState =
  | "available" // free on EVERY chosen day: the only state that can be picked
  | "taken" // taken on all the chosen days
  | "partial" // taken on some of the chosen days
  | "maintenance"
  | "inactive"
  | "unpriced"; // free, but its tier has no price yet, so the backend could not price a booking: not offered

export interface MapSeat {
  id: string;
  seatNumber: string;
  tier: SeatTier;
  floor: number;
  state: SeatState;
  // what is written on the seat: the column number, or the whole seat number when it has no row/column
  label: string;
  // price of ONE day in this slot, in paise (the backend's formula)
  pricePerDayPaise: number | null;
  // the chosen days this seat is already taken on
  takenDates: DateString[];
}

export interface MapRow {
  label: string;
  // a seat, or null for the aisle between seat groups
  cells: (MapSeat | null)[];
}

export interface MapSection {
  tier: SeatTier;
  pricePerDayPaise: number | null;
  rows: MapRow[];
  seatCount: number;
  freeCount: number;
}

export interface MapFloor {
  floor: number;
  sections: MapSection[];
  seatCount: number;
  freeCount: number;
}

export interface SeatMap {
  slot: TimeSlot;
  dates: DateString[];
  floors: MapFloor[];
  // plain object (not a Map) so the query cache can tell what changed between two refreshes
  seatsById: Record<string, MapSeat>;
  seatCount: number;
  freeCount: number;
}

export const TIER_ORDER: SeatTier[] = ["EXECUTIVE", "PROFESSIONAL", "STUDY"];

const SEAT_NUMBER = /^([A-Za-z]+)[\s-]?(\d{1,3})$/;

export function parseSeatNumber(seatNumber: string): { row: string; col: number | null } {
  const match = SEAT_NUMBER.exec(seatNumber.trim());
  return match ? { row: match[1]!.toUpperCase(), col: Number(match[2]) } : { row: "", col: null };
}

// A, B, ... Z, AA, AB: shorter first, then alphabetical. The row-less group goes last.
const compareRows = (a: string, b: string) => {
  if (a === "" || b === "") return a === "" ? (b === "" ? 0 : 1) : -1;
  return a.length - b.length || a.localeCompare(b);
};

export function classifySeat(seat: SeatAvailability, dates: readonly DateString[]): { state: SeatState; takenDates: DateString[] } {
  if (seat.availability === "MAINTENANCE") return { state: "maintenance", takenDates: [] };
  if (seat.availability === "INACTIVE") return { state: "inactive", takenDates: [] };

  const takenDates = seat.bookedDates.filter((date) => dates.includes(date)).sort();
  if (seat.availability === "AVAILABLE" && takenDates.length === 0) {
    return { state: seat.pricePerHourPaise === null ? "unpriced" : "available", takenDates };
  }
  // Taken on every chosen day, or (defensively) marked booked without saying which days: not usable either way.
  if (takenDates.length === 0 || takenDates.length >= dates.length) return { state: "taken", takenDates };
  return { state: "partial", takenDates };
}

// Seats of one tier on one floor -> rows. Columns line up across rows; a missing column number becomes ONE aisle
// (however many numbers are missing), so the plan stays compact and a gap reads as a walkway.
function buildRows(seats: MapSeat[], positions: Map<string, { row: string; col: number | null }>): MapRow[] {
  const placed = seats.filter((seat) => positions.get(seat.id)!.col !== null);
  const loose = seats.filter((seat) => positions.get(seat.id)!.col === null);

  const columns = [...new Set(placed.map((seat) => positions.get(seat.id)!.col!))].sort((a, b) => a - b);
  const index = new Map<number, number>();
  columns.forEach((column, i) => {
    const previous = columns[i - 1];
    index.set(column, i === 0 ? 0 : index.get(previous!)! + 1 + (column - previous! > 1 ? 1 : 0));
  });

  const byRow = new Map<string, MapSeat[]>();
  for (const seat of placed) {
    const row = positions.get(seat.id)!.row;
    byRow.set(row, [...(byRow.get(row) ?? []), seat]);
  }

  const rows: MapRow[] = [...byRow.entries()]
    .sort(([a], [b]) => compareRows(a, b))
    .map(([label, rowSeats]) => {
      const cells: (MapSeat | null)[] = [];
      for (const seat of rowSeats) cells[index.get(positions.get(seat.id)!.col!)!] = seat;
      return { label, cells: Array.from(cells, (cell) => cell ?? null) }; // fills the holes of a sparse array with null
    });

  // Seats with no row/column: plain rows of up to 8, in seat-number order.
  const sortedLoose = [...loose].sort((a, b) => a.seatNumber.localeCompare(b.seatNumber, undefined, { numeric: true }));
  for (let start = 0; start < sortedLoose.length; start += 8) rows.push({ label: "", cells: sortedLoose.slice(start, start + 8) });
  return rows;
}

const count = (seats: readonly MapSeat[]) => ({ seatCount: seats.length, freeCount: seats.filter((seat) => seat.state === "available").length });

export function buildSeatMap(result: AvailabilityResult, dates: readonly DateString[]): SeatMap {
  const positions = new Map<string, { row: string; col: number | null }>();
  const seats: MapSeat[] = result.seats.map((seat) => {
    const position = parseSeatNumber(seat.seatNumber);
    positions.set(seat.id, position);
    const { state, takenDates } = classifySeat(seat, dates);
    return {
      id: seat.id,
      seatNumber: seat.seatNumber,
      tier: seat.seatType,
      floor: seat.floor,
      state,
      label: position.col === null ? seat.seatNumber : String(position.col),
      pricePerDayPaise: seat.pricePerHourPaise === null ? null : pricePerDayPaise(seat.pricePerHourPaise, result.timeSlot),
      takenDates,
    };
  });

  const floors: MapFloor[] = [...new Set(seats.map((seat) => seat.floor))]
    .sort((a, b) => a - b)
    .map((floor) => {
      const onFloor = seats.filter((seat) => seat.floor === floor);
      const sections: MapSection[] = TIER_ORDER.flatMap((tier) => {
        const inTier = onFloor.filter((seat) => seat.tier === tier);
        if (inTier.length === 0) return [];
        return [
          {
            tier,
            pricePerDayPaise: inTier.find((seat) => seat.pricePerDayPaise !== null)?.pricePerDayPaise ?? null,
            rows: buildRows(inTier, positions),
            ...count(inTier),
          },
        ];
      });
      return { floor, sections, ...count(onFloor) };
    });

  return {
    slot: result.timeSlot,
    dates: [...dates],
    floors,
    seatsById: Object.fromEntries(seats.map((seat) => [seat.id, seat])),
    ...count(seats),
  };
}

// ---- wording -----------------------------------------------------------------------------------------------

export const isSelectable = (seat: MapSeat) => seat.state === "available";

// Why a seat cannot be picked, in plain words.
export function unavailableReason(seat: MapSeat, daysChosen: number): string {
  switch (seat.state) {
    case "taken":
      return daysChosen === 1 ? "Already booked for that day" : "Already booked on all your days";
    case "partial":
      return `Already booked on ${formatDateList(seat.takenDates)}`;
    case "maintenance":
      return "Out of service for maintenance";
    case "inactive":
      return "Not in use";
    case "unpriced":
      return "Not bookable yet (no price set)";
    default:
      return "";
  }
}

// What a screen reader says for a seat: "Seat B3, Professional, floor 1, available, ₹100 per day".
export function seatAriaLabel(seat: MapSeat, tierName: string, daysChosen: number, selected: boolean): string {
  const status = selected ? "selected" : seat.state === "available" ? "available" : unavailableReason(seat, daysChosen).toLowerCase();
  const price = seat.pricePerDayPaise === null ? "" : `, ${formatRupees(seat.pricePerDayPaise)} per day`;
  return `Seat ${seat.seatNumber}, ${tierName}, floor ${seat.floor}, ${status}${seat.state === "available" || selected ? price : ""}`;
}
