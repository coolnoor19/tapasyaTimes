import { Suspense } from "react";
import type { Metadata } from "next";
import { SeatSelection } from "@/features/seat-map/components/seat-selection";

export const metadata: Metadata = { title: "Choose your seat" };

export default function SeatsPage() {
  return (
    <Suspense>
      <SeatSelection />
    </Suspense>
  );
}
