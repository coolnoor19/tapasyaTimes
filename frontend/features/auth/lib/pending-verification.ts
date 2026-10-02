// Remembers, in this browser tab only, which email is waiting for its verification code, so it does not
// have to travel in the URL (URLs end up in browser history and server logs).

const KEY = "tt:pending-verification";
const PREFILL_KEY = "tt:prefill-email";

export interface PendingVerification {
  email: string;
  // when the latest code was sent (ms since epoch): the resend cooldown counts from here
  sentAt: number;
}

const storage = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null; // storage blocked (private mode, strict settings): the app still works, just without memory
  }
};

// Tell anything showing this memory that it changed (sessionStorage only announces changes made by OTHER tabs).
const CHANGED_EVENT = "tt:pending-verification-changed";
const announce = () => window.dispatchEvent(new Event(CHANGED_EVENT));

export function savePendingVerification(email: string, sentAt: number = Date.now()) {
  try {
    storage()?.setItem(KEY, JSON.stringify({ email, sentAt } satisfies PendingVerification));
  } catch {}
  announce();
}

export function readPendingVerification(): PendingVerification | null {
  return parsePending(getPendingSnapshot());
}

export function clearPendingVerification() {
  try {
    storage()?.removeItem(KEY);
  } catch {}
  announce();
}

// ---- for useSyncExternalStore: the form re-renders when the memory changes ----------------------------
// The snapshot is the raw stored text (a string or null), which stays identical until something changes.
export function subscribePending(listener: () => void) {
  window.addEventListener(CHANGED_EVENT, listener);
  return () => window.removeEventListener(CHANGED_EVENT, listener);
}
export function getPendingSnapshot(): string | null {
  try {
    return storage()?.getItem(KEY) ?? null;
  } catch {
    return null;
  }
}
// The server cannot read sessionStorage. undefined = "not known yet", which is not the same as "nothing saved".
export const getPendingServerSnapshot = (): string | null | undefined => undefined;

export function parsePending(raw: string | null): PendingVerification | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PendingVerification>;
    return typeof value.email === "string" && typeof value.sentAt === "number" ? { email: value.email, sentAt: value.sentAt } : null;
  } catch {
    return null;
  }
}

// After verifying, the login form opens with the email already filled in. Reading does not remove it
// (React may render a form twice while developing); the login form clears it once the person signs in.
export function savePrefillEmail(email: string) {
  try {
    storage()?.setItem(PREFILL_KEY, email);
  } catch {}
}

export function readPrefillEmail(): string {
  try {
    return storage()?.getItem(PREFILL_KEY) ?? "";
  } catch {
    return "";
  }
}

export function clearPrefillEmail() {
  try {
    storage()?.removeItem(PREFILL_KEY);
  } catch {}
}

// "asha.rao@gmail.com" -> "a••••@gmail.com"
export function maskEmail(email: string): string {
  const [name = "", domain = ""] = email.split("@");
  if (!domain) return email;
  return `${name.slice(0, 1)}${"•".repeat(Math.max(2, Math.min(name.length - 1, 5)))}@${domain}`;
}
