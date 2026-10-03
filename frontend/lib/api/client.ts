// One place that talks to the backend. Features call `apiRequest`, never `fetch` directly, so
// error handling, JSON, the auth header and (from F1) silent token refresh behave the same everywhere.

import { parseServerTiming, reportTiming } from "./timing";

const BASE_URL = "/api/v1"; // forwarded to the Express backend by next.config.ts

// The backend answers errors as { message, code?, details? }.
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly details: Record<string, unknown> | undefined;

  constructor(status: number, message: string, code?: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  // The request never got an answer: offline, server down, timeout.
  get isNetworkError() {
    return this.status === 0;
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

// Hooks the auth feature (F1) plugs in. Until then requests are simply sent without a token.
interface ApiHooks {
  getAccessToken: () => string | null;
  // Called on a 401. Return true when a new access token was obtained and the request may be retried once.
  onUnauthorized: () => Promise<boolean>;
}

let hooks: ApiHooks = { getAccessToken: () => null, onUnauthorized: async () => false };

export function configureApi(next: Partial<ApiHooks>) {
  hooks = { ...hooks, ...next };
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  query?: Record<string, string | number | boolean | readonly string[] | undefined | null>;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  // false for the login / register / refresh calls, which must not send or retry with a token
  auth?: boolean;
}

function buildUrl(path: string, query: RequestOptions["query"]) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    // Lists go as one comma-separated value: ?dates=2026-08-11,2026-08-12
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  const text = params.toString();
  return `${BASE_URL}${path}${text ? `?${text}` : ""}`;
}

async function parseError(response: Response): Promise<ApiError> {
  let payload: { message?: unknown; code?: unknown; details?: unknown } = {};
  try {
    payload = await response.json();
  } catch {
    // not JSON (a proxy error page, for example): fall back to a generic message
  }
  const message = typeof payload.message === "string" ? payload.message : "Something went wrong. Please try again.";
  const code = typeof payload.code === "string" ? payload.code : undefined;
  const details = payload.details && typeof payload.details === "object" ? (payload.details as Record<string, unknown>) : undefined;
  return new ApiError(response.status, message, code, details);
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const { method = "GET", query, body, headers = {}, signal, auth = true } = options;
  const token = auth ? hooks.getAccessToken() : null;
  const startedAt = performance.now();

  try {
    const response = await fetch(buildUrl(path, query), {
      method,
      credentials: "same-origin", // sends the refresh cookie to /auth/* endpoints
      signal: signal ?? null,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : null,
    });
    reportTiming({
      method,
      path,
      status: response.status,
      ms: performance.now() - startedAt,
      serverMs: parseServerTiming(response.headers.get("Server-Timing")),
      requestId: response.headers.get("X-Request-Id"),
    });
    return response;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.", "NETWORK_ERROR");
  }
}

// How far this computer's clock is from the server's (server minus local, in ms), learned from the `Date` header of
// every answer. A hold deadline is the server's time: a countdown against a wrong local clock would lie.
// The header only has whole seconds (the fraction is cut off), so the true time is somewhere in the second that follows:
// half a second is added to land in the middle. That is accurate enough for a 10 minute hold.
let serverClockOffsetMs = 0;

function learnServerClock(response: Response) {
  const header = response.headers.get("Date");
  const serverTime = header ? Date.parse(header) : Number.NaN;
  if (Number.isFinite(serverTime)) serverClockOffsetMs = serverTime + 500 - Date.now();
}

// "Now" according to the server.
export const serverNow = () => Date.now() + serverClockOffsetMs;

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options);
  learnServerClock(response);

  // An expired access token: refresh it once and replay the request.
  if (response.status === 401 && options.auth !== false && (await hooks.onUnauthorized())) {
    response = await send(path, options);
    learnServerClock(response);
  }

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
