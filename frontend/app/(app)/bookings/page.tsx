import type { Metadata } from "next";
import { CalendarCheck } from "lucide-react";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "My bookings" };

export default function BookingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="My bookings" description="Your upcoming and past reservations." />
      <ComingSoon icon={CalendarCheck} phase="F5" title="Your bookings will appear here" description="Each booking shows its seat, dates, status and the payment countdown while it is held." />
    </div>
  );
}
