import type { SeatTier } from "@/features/landing/types";
import type { AdminSeat, SeatStatus } from "../types";

// The seat list arrives in ONE request (GET /admin/seats returns everything). Searching, filtering and paging are plain
// functions of that array, so changing a filter never costs a request and is instant.

export const SEATS_PAGE_SIZE = 40;

type Params = { get(name: string): string | null };

export interface SeatFilters {
  search: string;
  tier?: SeatTier | undefined;
  status?: SeatStatus | undefined;
  floor?: number | undefined;
}

const TIERS = new Set<string>(["EXECUTIVE", "PROFESSIONAL", "STUDY"]);
const STATUSES = new Set<string>(["AVAILABLE", "MAINTENANCE", "INACTIVE"]);

// An address can be typed by anyone: anything that is not a known value is dropped.
export function parseSeatFilters(params: Params): SeatFilters {
  const filters: SeatFilters = { search: (params.get("q") ?? "").trim().slice(0, 20) };
  const tier = params.get("tier") ?? "";
  const status = params.get("status") ?? "";
  const floor = params.get("floor");
  if (TIERS.has(tier)) filters.tier = tier as SeatTier;
  if (STATUSES.has(status)) filters.status = status as SeatStatus;
  if (floor !== null && /^\d{1,3}$/.test(floor)) filters.floor = Number(floor);
  return filters;
}

export function filterSeats(seats: readonly AdminSeat[], filters: SeatFilters): AdminSeat[] {
  const needle = filters.search.toUpperCase();
  return seats.filter(
    (seat) =>
      (needle === "" || seat.seatNumber.includes(needle)) &&
      (filters.tier === undefined || seat.seatType === filters.tier) &&
      (filters.status === undefined || seat.status === filters.status) &&
      (filters.floor === undefined || seat.floor === filters.floor),
  );
}

export function summarizeSeats(seats: readonly AdminSeat[]) {
  let available = 0;
  let maintenance = 0;
  let inactive = 0;
  let withUpcoming = 0;
  for (const seat of seats) {
    if (seat.status === "AVAILABLE") available++;
    else if (seat.status === "MAINTENANCE") maintenance++;
    else inactive++;
    if ((seat.upcomingBookings ?? 0) > 0) withUpcoming++;
  }
  return { total: seats.length, available, maintenance, inactive, withUpcoming };
}

export const floorsOf = (seats: readonly AdminSeat[]): number[] => [...new Set(seats.map((seat) => seat.floor))].sort((a, b) => a - b);

// The same order the backend uses (by seat number), so a saved seat lands where a reload would put it.
export const sortSeats = (seats: readonly AdminSeat[]): AdminSeat[] => [...seats].sort((a, b) => (a.seatNumber < b.seatNumber ? -1 : a.seatNumber > b.seatNumber ? 1 : 0));
