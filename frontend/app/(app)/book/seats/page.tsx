import { Suspense } from "react";
import type { Metadata } from "next";
import { SeatsPlaceholder } from "@/features/booking/components/seats-placeholder";

export const metadata: Metadata = { title: "Choose your seat" };

export default function SeatsPage() {
  return (
    <Suspense>
      <SeatsPlaceholder />
    </Suspense>
  );
}
