import type { Metadata } from "next";
import { Armchair } from "lucide-react";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileCard } from "@/features/auth/components/profile-card";

export const metadata: Metadata = { title: "Book a seat" };

export default function BookPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Book a seat" description="Choose your dates and time, then pick your exact seat on the map." />
      <ProfileCard />
      <ComingSoon
        icon={Armchair}
        phase="F3 and F4"
        title="The booking flow is next"
        description="Pick a time slot and a range of days, then choose your seat on the live seat map."
      />
    </div>
  );
}
