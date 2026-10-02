-- Two ACTIVE time slots must never overlap in time. Bookings are unique per (seat, date, slot),
-- so overlapping slots (10:00-11:00 and 10:30-11:30) would let two people hold the same seat
-- at the same moment. The range is half-open, so back-to-back slots (10-11, 11-12) are fine.
-- Inactive slots are ignored, so an old slot can be kept for history. Violations raise 23P01.
ALTER TABLE "time_slots"
  ADD CONSTRAINT "time_slots_no_overlap"
  EXCLUDE USING gist (
    numrange(
      (extract(epoch from "start_time"))::numeric,
      (extract(epoch from "end_time"))::numeric,
      '[)'
    ) WITH &&
  ) WHERE ("is_active");
