import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest, configureApi, isApiError } from "@/lib/api/client";

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// Each call gets a FRESH Response: a response body can only be read once.
const respond = (status: number, body?: unknown) => () => Promise.resolve(json(status, body));

// Awaits a call that must fail and hands back the error (and fails the test if it did not reject).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const failure = (promise: Promise<unknown>): Promise<any> =>
  promise.then(() => { throw new Error("expected the request to fail"); }, (error: unknown) => error);

let fetchMock: ReturnType<typeof vi.fn>;
const lastCall = (index = 0) => {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit & { headers: Record<string, string> }];
  return { url, init, headers: init.headers };
};

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  configureApi({ getAccessToken: () => null, onUnauthorized: async () => false });
});
afterEach(() => vi.unstubAllGlobals());

describe("requests", () => {
  it("calls the /api/v1 prefix and returns the parsed JSON", async () => {
    fetchMock.mockImplementation(respond(200, { ok: true }));
    expect(await apiRequest("/seats")).toEqual({ ok: true });
    expect(lastCall().url).toBe("/api/v1/seats");
  });

  it("builds the query string: skips empty values, joins lists with commas, encodes text", async () => {
    fetchMock.mockImplementation(respond(200, {}));
    await apiRequest("/seats/availability", {
      query: { dates: ["2026-08-11", "2026-08-12"], timeSlotId: "abc", empty: "", nothing: undefined, none: null, search: "a b&c", n: 0, flag: false },
    });
    const url = new URL(lastCall().url, "http://x");
    expect(url.searchParams.get("dates")).toBe("2026-08-11,2026-08-12");
    expect(url.searchParams.get("timeSlotId")).toBe("abc");
    expect(url.searchParams.get("search")).toBe("a b&c");
    expect(url.searchParams.get("n")).toBe("0"); // zero and false are real values, not "empty"
    expect(url.searchParams.get("flag")).toBe("false");
    expect(url.searchParams.has("empty")).toBe(false);
    expect(url.searchParams.has("nothing")).toBe(false);
    expect(url.searchParams.has("none")).toBe(false);
  });

  it("sends a JSON body with the content type, and no content type without a body", async () => {
    fetchMock.mockImplementation(respond(201, {}));
    await apiRequest("/bookings", { method: "POST", body: { seatId: "1" }, headers: { "Idempotency-Key": "key-12345678" } });
    expect(lastCall().init.body).toBe('{"seatId":"1"}');
    expect(lastCall().headers["Content-Type"]).toBe("application/json");
    expect(lastCall().headers["Idempotency-Key"]).toBe("key-12345678");

    await apiRequest("/bookings");
    expect(lastCall(1).headers["Content-Type"]).toBeUndefined();
  });

  it("sends the access token as a Bearer header, but not when auth is false", async () => {
    configureApi({ getAccessToken: () => "tok123" });
    fetchMock.mockImplementation(respond(200, {}));
    await apiRequest("/bookings");
    await apiRequest("/auth/login", { method: "POST", body: {}, auth: false });
    expect(lastCall(0).headers.Authorization).toBe("Bearer tok123");
    expect(lastCall(1).headers.Authorization).toBeUndefined();
  });

  it("returns undefined for 204 No Content", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response(null, { status: 204 })));
    expect(await apiRequest("/auth/logout", { method: "POST" })).toBeUndefined();
  });
});

describe("errors", () => {
  it("turns the backend's { message, code, details } into an ApiError", async () => {
    fetchMock.mockImplementation(respond(409, { message: "Seat A01 is not available on: 2026-08-12", code: "SEAT_TAKEN", details: { conflictingDates: ["2026-08-12"] } }));
    const error = await failure(apiRequest("/bookings", { method: "POST", body: {} }));
    expect(isApiError(error)).toBe(true);
    expect(error).toMatchObject({ status: 409, code: "SEAT_TAKEN", message: "Seat A01 is not available on: 2026-08-12", details: { conflictingDates: ["2026-08-12"] } });
    expect(error.isNetworkError).toBe(false);
  });

  it("uses a friendly generic message when the error body is not JSON (a proxy error page)", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response("<html>Bad gateway</html>", { status: 502 })));
    const error = await failure(apiRequest("/seats"));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(502);
    expect(error.message).not.toContain("<html>");
    expect(error.message.length).toBeGreaterThan(5);
  });

  it("ignores a non-string message or a non-object details from the server", async () => {
    fetchMock.mockImplementation(respond(400, { message: { evil: true }, code: 7, details: "x" }));
    const error = await failure(apiRequest("/x"));
    expect(typeof error.message).toBe("string");
    expect(error.code).toBeUndefined();
    expect(error.details).toBeUndefined();
  });

  it("reports an unreachable server as a network error with status 0", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const error = await failure(apiRequest("/seats"));
    expect(error).toMatchObject({ status: 0, code: "NETWORK_ERROR" });
    expect(error.isNetworkError).toBe(true);
  });

  it("lets a cancelled request through as an AbortError instead of showing 'cannot reach server'", async () => {
    fetchMock.mockRejectedValue(new DOMException("aborted", "AbortError"));
    const error = await failure(apiRequest("/seats"));
    expect(error.name).toBe("AbortError");
    expect(isApiError(error)).toBe(false);
  });
});

describe("expired access token (401)", () => {
  it("refreshes once and replays the request with the new token", async () => {
    let token = "old";
    configureApi({
      getAccessToken: () => token,
      onUnauthorized: async () => {
        token = "new";
        return true;
      },
    });
    fetchMock.mockResolvedValueOnce(json(401, { message: "expired" })).mockResolvedValueOnce(json(200, { data: 1 }));

    expect(await apiRequest("/bookings")).toEqual({ data: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(lastCall(0).headers.Authorization).toBe("Bearer old");
    expect(lastCall(1).headers.Authorization).toBe("Bearer new");
  });

  it("gives up with the 401 when the refresh fails", async () => {
    fetchMock.mockImplementation(respond(401, { message: "expired" }));
    const error = await failure(apiRequest("/bookings"));
    expect(error.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never loops: a second 401 after the retry is returned as an error", async () => {
    configureApi({ onUnauthorized: async () => true });
    fetchMock.mockImplementation(respond(401, { message: "still no" }));
    const error = await failure(apiRequest("/bookings"));
    expect(error.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not try to refresh for calls made with auth: false (a wrong password is a 401 too)", async () => {
    const refresh = vi.fn(async () => true);
    configureApi({ onUnauthorized: refresh });
    fetchMock.mockImplementation(respond(401, { message: "Invalid email or password" }));
    const error = await failure(apiRequest("/auth/login", { method: "POST", body: {}, auth: false }));
    expect(error.status).toBe(401);
    expect(refresh).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
