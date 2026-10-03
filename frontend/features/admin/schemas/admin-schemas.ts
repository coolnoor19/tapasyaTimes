import { z } from "zod";

// These mirror the backend's rules (backend/src/validators/admin.validator.ts) so mistakes are caught on the page.
// The backend still re-checks everything.

export const seatFormSchema = z.object({
  seatNumber: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Enter a seat number")
    .regex(/^[A-Z0-9-]{1,10}$/, "Use 1 to 10 letters, digits or dashes, like A07"),
  seatType: z.enum(["EXECUTIVE", "PROFESSIONAL", "STUDY"]),
  floor: z.number("Enter the floor number").int("Use a whole number").min(0, "The floor can’t be below 0").max(100, "The floor can’t be above 100"),
  status: z.enum(["AVAILABLE", "MAINTENANCE", "INACTIVE"]),
});

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a time");

export const slotFormSchema = z
  .object({
    startTime: time,
    endTime: time,
    displayName: z.string().trim().max(50, "Use 50 characters or fewer"),
  })
  .refine((slot) => slot.endTime > slot.startTime, { message: "The end must be after the start", path: ["endTime"] });

export type SeatFormValues = z.input<typeof seatFormSchema>;
export type SeatFormOutput = z.output<typeof seatFormSchema>;
export type SlotFormValues = z.input<typeof slotFormSchema>;
export type SlotFormOutput = z.output<typeof slotFormSchema>;
