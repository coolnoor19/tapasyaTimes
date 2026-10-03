import { Suspense } from "react";
import type { Metadata } from "next";
import { SeatsScreen } from "@/features/admin/components/seats-screen";

export const metadata: Metadata = { title: "Seats" };

export default function AdminSeatsPage() {
  return (
    <Suspense>
      <SeatsScreen />
    </Suspense>
  );
}
