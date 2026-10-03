import type { Metadata } from "next";
import { BookingDetail } from "@/features/bookings/components/booking-detail";

export const metadata: Metadata = { title: "Booking" };

export default async function BookingPage({ params }: PageProps<"/bookings/[id]">) {
  const { id } = await params;
  return <BookingDetail id={id} />;
}
