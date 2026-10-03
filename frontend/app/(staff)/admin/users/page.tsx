import { Suspense } from "react";
import type { Metadata } from "next";
import { UsersScreen } from "@/features/admin/components/users-screen";

export const metadata: Metadata = { title: "Users and roles" };

export default function AdminUsersPage() {
  return (
    <Suspense>
      <UsersScreen />
    </Suspense>
  );
}
