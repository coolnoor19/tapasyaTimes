// Measures every API call so a slow backend is noticed instead of guessed at.
//  - `ms` is how long the browser waited for the answer to START (until the response headers arrived).
//  - `serverMs` is how much of that the backend itself spent (its Server-Timing header). The rest is network + proxy.
//    High serverMs = the backend or database is slow. Low serverMs but high ms = the connection or the proxy is slow.
// In development a slow call is written to the console. In production nothing is printed, but anything (an error
// tracker, an analytics call) can subscribe with `onRequestTiming` without touching the API client.

export interface RequestTiming {
  method: string;
  path: string; // without the query string, which can hold a customer's search text
  status: number;
  ms: number;
  serverMs: number | null;
  requestId: string | null;
}

export const SLOW_REQUEST_MS = 1500;

type Listener = (timing: RequestTiming) => void;
const listeners = new Set<Listener>();

export function onRequestTiming(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// "total;dur=12.3" -> 12.3
export function parseServerTiming(header: string | null): number | null {
  const match = header ? /(?:^|,)\s*total;dur=([\d.]+)/.exec(header) : null;
  const value = match ? Number(match[1]) : Number.NaN;
  return Number.isFinite(value) ? value : null;
}

export function reportTiming(timing: RequestTiming) {
  if (process.env.NODE_ENV !== "production" && timing.ms >= SLOW_REQUEST_MS) {
    const where = timing.serverMs === null ? "" : `, backend ${Math.round(timing.serverMs)} ms`;
    console.warn(`[slow api] ${timing.method} ${timing.path} took ${Math.round(timing.ms)} ms (HTTP ${timing.status}${where})`);
  }
  for (const listener of listeners) {
    try {
      listener(timing);
    } catch {
      // a broken subscriber must never break a request
    }
  }
}
