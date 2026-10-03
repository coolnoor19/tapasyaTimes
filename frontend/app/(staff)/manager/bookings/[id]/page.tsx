import type { Metadata } from "next";
import { StaffBookingDetail } from "@/features/staff/components/staff-booking-detail";

export const metadata: Metadata = { title: "Booking" };

export default async function StaffBookingPage({ params }: PageProps<"/manager/bookings/[id]">) {
  const { id } = await params;
  return <StaffBookingDetail id={id} />;
}
