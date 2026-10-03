import { Suspense } from "react";
import type { Metadata } from "next";
import { OccupancyScreen } from "@/features/staff/components/occupancy-screen";

export const metadata: Metadata = { title: "Occupancy" };

export default function OccupancyPage() {
  return (
    <Suspense>
      <OccupancyScreen />
    </Suspense>
  );
}
