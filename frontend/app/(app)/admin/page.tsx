import type { Metadata } from "next";
import { Settings2 } from "lucide-react";
import { ComingSoon } from "@/components/layout/coming-soon";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileCard } from "@/features/auth/components/profile-card";

export const metadata: Metadata = { title: "Admin" };

export default function AdminPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Admin" description="Seats, time slots, prices, people and the audit log." />
      <ProfileCard />
      <ComingSoon icon={Settings2} phase="F7" title="The admin tools are coming" description="Manage seats, time slots, prices and users, and review who changed what." />
    </div>
  );
}
