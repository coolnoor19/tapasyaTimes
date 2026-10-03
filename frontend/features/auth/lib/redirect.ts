import type { Role } from "../types";

// Where each kind of account lands after signing in.
export function roleHome(role: Role): string {
  if (role === "ADMIN") return "/admin";
  if (role === "MANAGER") return "/manager";
  return "/book";
}

// Pages that belong to staff only. Everything else is open to any signed-in account.
export function canAccess(role: Role, path: string): boolean {
  const pathname = path.split(/[?#]/)[0] ?? "";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return role === "ADMIN";
  if (pathname === "/manager" || pathname.startsWith("/manager/")) return role === "ADMIN" || role === "MANAGER";
  return true;
}

const AUTH_PAGES = ["/login", "/register", "/verify-email", "/staff/login"];

// `?next=/bookings` lets a visitor return to the page they wanted after signing in. It comes from the URL,
// so anyone can craft it: only a plain path on THIS site is accepted. Otherwise a link such as
// /login?next=//evil.com would send a freshly signed-in user to another website (an "open redirect").
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || next.length > 300) return null;
  if (!next.startsWith("/")) return null; // "https://evil.com", "javascript:..."
  if (next.startsWith("//")) return null; // protocol-relative: //evil.com
  if (next.includes("\\")) return null; // some browsers treat a backslash like a slash
  if (/[\u0000-\u001f\u007f]/.test(next)) return null; // tabs and newlines can hide a second slash
  const pathname = next.split(/[?#]/)[0] ?? "";
  if (AUTH_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`))) return null; // no login loops
  return next;
}

export function destinationAfterLogin(role: Role, next: string | null | undefined): string {
  const safe = safeNextPath(next);
  return safe && canAccess(role, safe) ? safe : roleHome(role);
}

// "/login?next=%2Fbookings" for a visitor who tried to open /bookings while signed out.
// reason=expired makes the login page explain why they are seeing it.
export function loginUrlFor(path: string, reason?: "expired"): string {
  const params = new URLSearchParams();
  const safe = safeNextPath(path);
  if (safe && safe !== "/") params.set("next", safe);
  if (reason) params.set("reason", reason);
  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}

// The staff portal has its own sign-in page. Same rules as loginUrlFor: only a safe on-site path is kept.
export function staffLoginUrlFor(path: string, reason?: "expired"): string {
  const params = new URLSearchParams();
  const safe = safeNextPath(path);
  if (safe && safe !== "/") params.set("next", safe);
  if (reason) params.set("reason", reason);
  const query = params.toString();
  return query ? `/staff/login?${query}` : "/staff/login";
}

export const isStaffRole = (role: Role) => role === "ADMIN" || role === "MANAGER";
