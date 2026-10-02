import { Armchair, CalendarCheck, LayoutDashboard, Settings2, type LucideIcon } from "lucide-react";
import type { Role } from "@/features/auth/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  // Who sees this link. Left out = everyone who is signed in.
  roles?: Role[];
}

// The links in the app header. A link is only a convenience: the page itself and the backend still enforce access.
export const APP_NAV: NavItem[] = [
  { href: "/book", label: "Book a seat", icon: Armchair },
  { href: "/bookings", label: "My bookings", icon: CalendarCheck },
  { href: "/manager", label: "Floor", icon: LayoutDashboard, roles: ["MANAGER", "ADMIN"] },
  { href: "/admin", label: "Admin", icon: Settings2, roles: ["ADMIN"] },
];

export const navFor = (role: Role): NavItem[] => APP_NAV.filter((item) => !item.roles || item.roles.includes(role));

export const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);
