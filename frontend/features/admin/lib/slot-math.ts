import type { AdminTimeSlot } from "../types";

// Active time slots may not overlap (the database enforces it). This only lets the form warn BEFORE the request,
// using the list that is already on screen; the backend remains the judge.
export function findOverlap(slots: readonly AdminTimeSlot[], start: string, end: string, ignoreId?: string): AdminTimeSlot | undefined {
  if (!start || !end || end <= start) return undefined;
  return slots.find((slot) => slot.isActive && slot.id !== ignoreId && start < slot.endTime && end > slot.startTime);
}

// Same order as the backend: earliest first, then by name.
export const sortSlots = (slots: readonly AdminTimeSlot[]): AdminTimeSlot[] =>
  [...slots].sort((a, b) => (a.startTime === b.startTime ? a.displayName.localeCompare(b.displayName) : a.startTime < b.startTime ? -1 : 1));

// "10:00", "10:30" -> 30
export function minutesBetween(start: string, end: string): number {
  const toMinutes = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number) as [number, number];
    return hours * 60 + minutes;
  };
  return toMinutes(end) - toMinutes(start);
}
