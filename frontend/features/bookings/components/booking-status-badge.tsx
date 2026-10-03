import { Badge } from "@/components/ui/badge";
import { PHASE_LABEL, PHASE_TONE, type BookingPhase } from "../lib/booking-state";

export function BookingStatusBadge({ phase }: { phase: BookingPhase }) {
  return <Badge tone={PHASE_TONE[phase]}>{PHASE_LABEL[phase]}</Badge>;
}
