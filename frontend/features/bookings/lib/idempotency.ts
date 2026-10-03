// One Idempotency-Key per "booking attempt". The key is remembered (per tab) until the attempt is settled, so:
//   - a double click, a flaky network retry or a refresh in the middle of reserving all send the SAME key, and the
//     backend answers with the booking it already made instead of making a second one;
//   - once the attempt has an answer (a booking, or a clear refusal) the key is dropped, so the next attempt is new.
// Storage can be missing (private window, blocked site data): then the key only lives in memory, which still
// covers the double click.

const PREFIX = "tt:booking-key:";
const memory = new Map<string, string>();

// 8-100 characters of letters, digits, "_" and "-": what the backend accepts.
function newKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID(); // only in secure contexts (https, localhost)
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// What makes two attempts "the same booking": same seat, slot and days.
export const attemptFingerprint = (seatId: string, slotId: string, dates: readonly string[]) => `${seatId}|${slotId}|${[...dates].sort().join(",")}`;

export function keyForAttempt(fingerprint: string): string {
  const stored = memory.get(fingerprint) ?? readStored(fingerprint);
  if (stored) {
    memory.set(fingerprint, stored);
    return stored;
  }
  const key = newKey();
  memory.set(fingerprint, key);
  writeStored(fingerprint, key);
  return key;
}

export function forgetAttempt(fingerprint: string): void {
  memory.delete(fingerprint);
  try {
    sessionStorage.removeItem(PREFIX + fingerprint);
  } catch {
    // storage unavailable: nothing to forget
  }
}

function readStored(fingerprint: string): string | null {
  try {
    return sessionStorage.getItem(PREFIX + fingerprint);
  } catch {
    return null;
  }
}

function writeStored(fingerprint: string, key: string) {
  try {
    sessionStorage.setItem(PREFIX + fingerprint, key);
  } catch {
    // storage unavailable: the in-memory copy is enough for this page
  }
}
