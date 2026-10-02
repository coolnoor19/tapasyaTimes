import { Suspense } from "react";
import type { Metadata } from "next";
import { BookingFlow } from "@/features/booking/components/booking-flow";

export const metadata: Metadata = { title: "Book a seat" };

// useSearchParams (the saved choice in the address) needs a Suspense boundary on a prerendered page.
export default function BookPage() {
  return (
    <Suspense>
      <BookingFlow />
    </Suspense>
  );
}
