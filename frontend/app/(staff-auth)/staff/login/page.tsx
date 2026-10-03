import { Suspense } from "react";
import type { Metadata } from "next";
import { StaffLoginForm } from "@/features/staff/components/staff-login-form";

export const metadata: Metadata = { title: "Staff sign in" };

// useSearchParams (for ?next=) needs a Suspense boundary on a prerendered page.
export default function StaffLoginPage() {
  return (
    <Suspense>
      <StaffLoginForm />
    </Suspense>
  );
}
