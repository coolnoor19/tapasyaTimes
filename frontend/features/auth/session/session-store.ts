import { configureApi, isApiError } from "@/lib/api/client";
import { authApi } from "../api/auth-api";
import type { AuthResponse, SessionUser } from "../types";

// ---------------------------------------------------------------------------
// The signed-in state of this browser tab.
//
// - The ACCESS token (15 minutes) lives only in this module's memory: a script injected into the page
//   cannot find it in localStorage, and closing the tab discards it.
// - The REFRESH token lives in an httpOnly cookie that JavaScript can never read. Calling /auth/refresh
//   swaps it for a new pair, which is how a session survives a page reload.
// - A small flag in localStorage ("had a session") only tells us whether it is worth asking. It is not a
//   credential: without it a first-time visitor would trigger a pointless request on every page load.
// ---------------------------------------------------------------------------

export type SessionStatus =
  | "loading" // working out whether there is a session
  | "authenticated"
  | "anonymous"
  | "unavailable"; // the server could not be reached, so we do not know (and must not log anyone out)

export interface SessionState {
  status: SessionStatus;
  user: SessionUser | null;
  accessToken: string | null;
  // when the access token stops working (ms since epoch)
  expiresAt: number | null;
  // Why an anonymous session ended: the person signed out ("user"), or the server ended it ("expired").
  // Decides where the next redirect goes and whether to explain.
  endedBy: "user" | "expired" | null;
}

const EMPTY = { user: null, accessToken: null, expiresAt: null, endedBy: null } as const;
const LOADING: SessionState = { ...EMPTY, status: "loading" };
const ANONYMOUS: SessionState = { ...EMPTY, status: "anonymous" };
const UNAVAILABLE: SessionState = { ...EMPTY, status: "unavailable" };

let state: SessionState = LOADING;
const listeners = new Set<() => void>();

export const getSnapshot = () => state;
// What the server renders: it never knows about a session, so every page starts as "loading".
export const getServerSnapshot = () => LOADING;
export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setState(next: SessionState) {
  state = next;
  listeners.forEach((listener) => listener());
}

// ---- the "had a session" flag -------------------------------------------------

const HINT_KEY = "tt:has-session";

function readHint(): boolean {
  try {
    return window.localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return true; // storage is blocked, so we cannot tell: asking the server is the safe choice
  }
}

function writeHint(value: boolean) {
  try {
    if (value) window.localStorage.setItem(HINT_KEY, "1");
    else window.localStorage.removeItem(HINT_KEY);
  } catch {}
}

// ---- refreshing ----------------------------------------------------------------

// Ask for a new token a minute before the old one stops working, so the person never hits an expired one.
const REFRESH_MARGIN_MS = 60_000;
const MIN_REFRESH_DELAY_MS = 5_000;
// When the tab comes back to the foreground with a token this close to expiry, renew straight away.
const VISIBLE_RENEW_WINDOW_MS = 30_000;

let refreshTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleRefresh(expiresInMs: number) {
  clearTimeout(refreshTimer);
  const delay = Math.max(MIN_REFRESH_DELAY_MS, expiresInMs - REFRESH_MARGIN_MS);
  refreshTimer = setTimeout(() => void refreshSession(), delay);
}

export function setSession(auth: AuthResponse) {
  const expiresInMs = auth.expiresIn * 1000;
  setState({ status: "authenticated", user: auth.user, accessToken: auth.accessToken, expiresAt: Date.now() + expiresInMs, endedBy: null });
  writeHint(true);
  scheduleRefresh(expiresInMs);
}

export function clearSession(options: { broadcast?: boolean; endedBy?: "user" | "expired" } = {}) {
  clearTimeout(refreshTimer);
  writeHint(false);
  setState({ ...ANONYMOUS, endedBy: options.endedBy ?? null });
  if (options.broadcast) channel?.postMessage("logout");
}

// Two browser tabs share one refresh cookie, and the backend rotates it on every refresh. If both
// refresh at the same instant, the slower one is refused AND the backend answers it by clearing the cookie
// that the faster one just received: the person is signed out for no reason. The Web Locks API makes
// tabs take turns, so the second one simply uses the newest cookie.
function runExclusive<T>(task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  return locks ? (locks.request("tapasya-session-refresh", task) as Promise<T>) : task();
}

let inFlight: Promise<boolean> | null = null;

// Exchanges the refresh cookie for a new access token. Calls made while one is already running share its
// answer (five requests failing together cause one refresh, not five).
export function refreshSession(): Promise<boolean> {
  if (!inFlight) {
    inFlight = runExclusive(doRefresh).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function doRefresh(): Promise<boolean> {
  try {
    setSession(await authApi.refresh());
    return true;
  } catch (error) {
    // The server answered "no": the session is really over (expired, signed out elsewhere, suspended).
    if (isApiError(error) && (error.status === 401 || error.status === 403)) {
      // Someone who had a session and lost it is told so; a visitor who never had one is not.
      clearSession({ endedBy: "expired" });
      return false;
    }
    // The server could not be reached, or failed. That says nothing about the session, so keep it and
    // do not sign anyone out because of a bad network.
    if (state.status === "loading") setState(UNAVAILABLE);
    return false;
  }
}

// ---- starting up and signing out ------------------------------------------------------

let started = false;
let channel: BroadcastChannel | null = null;

// Called once when the app loads in the browser.
export function bootstrapSession() {
  if (started || typeof window === "undefined") return;
  started = true;

  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel("tapasya-auth");
    // Signed out in another tab: this tab follows straight away.
    channel.onmessage = (event) => {
      if (event.data === "logout") clearSession({ endedBy: "user" });
    };
  }

  document.addEventListener("visibilitychange", () => {
    // A laptop that slept may have missed the scheduled refresh (timers pause while asleep).
    if (document.visibilityState !== "visible") return;
    if (state.status === "authenticated" && (state.expiresAt ?? 0) - Date.now() < VISIBLE_RENEW_WINDOW_MS) void refreshSession();
    if (state.status === "unavailable") retryBootstrap();
  });
  window.addEventListener("online", () => {
    if (state.status === "unavailable") retryBootstrap();
  });

  if (readHint()) void refreshSession();
  else setState(ANONYMOUS);
}

// For the "could not reach the server" screen.
export function retryBootstrap() {
  setState(LOADING);
  void refreshSession();
}

// Ends the session here and, through the backend, on this device's refresh cookie.
export async function signOut() {
  try {
    await authApi.logout();
  } catch {
    // Offline or the server failed. The person still leaves: the access token is gone from memory, and the
    // refresh cookie expires by itself.
  }
  clearSession({ broadcast: true, endedBy: "user" });
}

// Requests send the in-memory token, and an expired one is renewed once and replayed.
configureApi({
  getAccessToken: () => state.accessToken,
  onUnauthorized: async () => (state.status === "authenticated" ? refreshSession() : false),
});

// Tests only: a clean slate between cases.
export function __resetSessionForTests() {
  clearTimeout(refreshTimer);
  channel?.close();
  channel = null;
  state = LOADING;
  started = false;
  inFlight = null;
  listeners.clear();
}
