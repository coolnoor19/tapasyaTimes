import { Armchair, BarChart3, CalendarCheck, Clock, IndianRupee, LayoutDashboard, LayoutGrid, ScrollText, UserCog, Users, type LucideIcon } from "lucide-react";
import type { Role } from "@/features/auth/types";

export interface StaffNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  // listed so people can see what is coming, but not a link yet
  soon?: boolean;
}

export interface StaffNavGroup {
  title: string | null;
  items: StaffNavItem[];
}

// Managers and admins both land on the overview; admins' home is /admin, managers' is /manager (both show the same dashboard).
export const overviewHref = (role: Role) => (role === "ADMIN" ? "/admin" : "/manager");

const FLOOR: StaffNavItem[] = [
  { href: "/manager/board", label: "Floor board", icon: LayoutGrid },
  { href: "/manager/occupancy", label: "Occupancy", icon: BarChart3 },
  { href: "/manager/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/manager/customers", label: "Customers", icon: Users },
];

// Admin only. The backend refuses every /admin call from any other role; this list only decides what is shown.
const ADMIN: StaffNavItem[] = [
  { href: "/admin/seats", label: "Seats", icon: Armchair },
  { href: "/admin/time-slots", label: "Time slots", icon: Clock },
  { href: "/admin/prices", label: "Prices", icon: IndianRupee },
  { href: "/admin/users", label: "Users and roles", icon: UserCog },
  { href: "/admin/audit-log", label: "Audit log", icon: ScrollText },
];

export function staffNavFor(role: Role): StaffNavGroup[] {
  const groups: StaffNavGroup[] = [
    { title: null, items: [{ href: overviewHref(role), label: "Overview", icon: LayoutDashboard }] },
    { title: "Floor", items: FLOOR },
  ];
  if (role === "ADMIN") groups.push({ title: "Admin", items: ADMIN });
  return groups;
}

// The overview links are exact (/manager must not light up on /manager/board); every other link matches its sub-pages too.
export const isStaffActive = (pathname: string, href: string) =>
  href === "/manager" || href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
