import { Suspense } from "react";
import type { Metadata } from "next";
import { BookingsScreen } from "@/features/staff/components/bookings-screen";

export const metadata: Metadata = { title: "Bookings" };

export default function StaffBookingsPage() {
  return (
    <Suspense>
      <BookingsScreen />
    </Suspense>
  );
}
