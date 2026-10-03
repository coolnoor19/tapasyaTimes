import type { Metadata } from "next";
import { TimeSlotsScreen } from "@/features/admin/components/time-slots-screen";

export const metadata: Metadata = { title: "Time slots" };

export default function AdminTimeSlotsPage() {
  return <TimeSlotsScreen />;
}
