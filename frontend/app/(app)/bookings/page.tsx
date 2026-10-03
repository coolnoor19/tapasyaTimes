import { Suspense } from "react";
import type { Metadata } from "next";
import { BookingsList } from "@/features/bookings/components/bookings-list";

export const metadata: Metadata = { title: "My bookings" };

export default function BookingsPage() {
  return (
    <Suspense>
      <BookingsList />
    </Suspense>
  );
}
