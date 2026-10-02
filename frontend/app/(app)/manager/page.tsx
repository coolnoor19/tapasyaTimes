import type { Metadata } from "next";
import { LayoutDashboard } from "lucide-react";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileCard } from "@/features/auth/components/profile-card";

export const metadata: Metadata = { title: "Floor" };

export default function ManagerPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Floor" description="Who is in, which seats are free, and how full the space is." />
      <ProfileCard />
      <ComingSoon icon={LayoutDashboard} phase="F6" title="The floor board is coming" description="Today’s seats by time slot, occupancy by day, and booking and customer lookup." />
    </div>
  );
}
