import { TIERS } from "@/features/landing/content";
import { formatDayWithYear, formatTime, nowInIndia } from "@/lib/dates";
import { formatPerHour } from "@/lib/money";

// Turns the audit log's technical words (SEAT_UPDATED, pricePerHourPaise) into sentences an admin can read.

export const ACTION_LABELS: Record<string, string> = {
  SEAT_CREATED: "Seat added",
  SEAT_UPDATED: "Seat changed",
  SLOT_CREATED: "Time slot added",
  SLOT_UPDATED: "Time slot changed",
  PRICE_UPDATED: "Price changed",
  USER_STATUS_CHANGED: "Account status changed",
  USER_ROLE_CHANGED: "Role changed",
};

export const TARGET_LABELS: Record<string, string> = {
  SEAT: "Seat",
  TIME_SLOT: "Time slot",
  SEAT_PRICE: "Price",
  USER: "User",
};

const FIELD_LABELS: Record<string, string> = {
  seatNumber: "Seat number",
  seatType: "Tier",
  floor: "Floor",
  status: "Status",
  startTime: "Starts",
  endTime: "Ends",
  displayName: "Name",
  isActive: "Switched",
  pricePerHourPaise: "Price",
  role: "Role",
};

const ENUM_LABELS: Record<string, string> = {
  AVAILABLE: "Available",
  MAINTENANCE: "Maintenance",
  INACTIVE: "Switched off",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  USER: "Customer",
  MANAGER: "Manager",
  ADMIN: "Admin",
};

export const actionLabel = (action: string) => ACTION_LABELS[action] ?? action;
export const targetLabel = (type: string) => TARGET_LABELS[type] ?? type;

function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (field === "pricePerHourPaise" && typeof value === "number") return formatPerHour(value);
  if (field === "isActive" && typeof value === "boolean") return value ? "on" : "off";
  if (field === "seatType" && typeof value === "string" && value in TIERS) return TIERS[value as keyof typeof TIERS].name;
  if ((field === "startTime" || field === "endTime") && typeof value === "string") return formatTime(value);
  if (typeof value === "string") return ENUM_LABELS[value] ?? value;
  return String(value);
}

export interface Change {
  field: string;
  label: string;
  from: string | null; // null for a record that was just created (there is no "before")
  to: string;
}

// The fields that changed, as "Status: Available → Maintenance". Only keys present in `after` are shown.
export function describeChanges(before: Record<string, unknown> | null, after: Record<string, unknown> | null): Change[] {
  if (!after) return [];
  return Object.keys(after).map((field) => ({
    field,
    label: FIELD_LABELS[field] ?? field,
    from: before && field in before ? formatValue(field, before[field]) : null,
    to: formatValue(field, after[field]),
  }));
}

// "12 Aug, 3:42 PM" in India time (the clock the whole product runs on).
export function formatWhen(iso: string): string {
  const moment = new Date(iso);
  if (Number.isNaN(moment.getTime())) return "";
  const { date, time } = nowInIndia(moment);
  return `${formatDayWithYear(date)}, ${formatTime(time)}`;
}

// A price entry is identified by its tier name; every other entry by an id, which is shortened for reading.
export function targetName(type: string, id: string): string {
  if (type === "SEAT_PRICE" && id in TIERS) return TIERS[id as keyof typeof TIERS].name;
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

// Where "more about this" lives. Only users have a page of their own.
export const targetHref = (type: string, id: string): string | null => (type === "USER" ? `/admin/users/${id}` : null);

// The audit log screen's filter by what changed.
export const AUDIT_TARGET_OPTIONS = Object.entries(TARGET_LABELS).map(([value, label]) => ({ value, label }));
export const AUDIT_ACTION_OPTIONS = Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }));
