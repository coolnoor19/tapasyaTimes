export type SeatTier = "EXECUTIVE" | "PROFESSIONAL" | "STUDY";

// GET /public/overview (no login needed)
export interface PublicOverview {
  currency: "INR";
  tiers: { seatType: SeatTier; pricePerHourPaise: number | null; seatCount: number }[];
  timeSlots: { displayName: string; startTime: string; endTime: string }[];
}
