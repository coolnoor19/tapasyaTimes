import { afterAll, describe, expect, it } from "vitest"
import request from "supertest"
import { env } from "../../src/config/env.js"
import { createApp } from "../../src/app.js"

// These requests are rejected before any database or email work happens, so
// they run without a test database.
const app = createApp()

describe("API basics", () => {
    it("answers the health check", async () => {
        const res = await request(app).get("/api/v1/health")
        expect(res.status).toBe(200)
        expect(res.body).toEqual({ message: "API is healthy" })
    })

    it("returns a JSON 404 for unknown routes", async () => {
        const res = await request(app).get("/api/v1/does-not-exist")
        expect(res.status).toBe(404)
        expect(res.body).toEqual({ message: "Route not found" })
    })

    it("returns 400 (not 500) for malformed JSON", async () => {
        const res = await request(app)
            .post("/api/v1/auth/register")
            .set("Content-Type", "application/json")
            .send("{bad json")
        expect(res.status).toBe(400)
        expect(res.body).toEqual({ message: "Invalid JSON body" })
    })

    it("returns 413 for a body over 10kb", async () => {
        const res = await request(app)
            .post("/api/v1/auth/register")
            .send({ firstName: "a".repeat(20_000) })
        expect(res.status).toBe(413)
        expect(res.body).toEqual({ message: "Request body too large" })
    })
})

describe("security headers and request ids", () => {
    it("sets helmet headers and hides the framework", async () => {
        const res = await request(app).get("/api/v1/health")
        expect(res.headers["x-content-type-options"]).toBe("nosniff")
        expect(res.headers["strict-transport-security"]).toBeDefined()
        expect(res.headers["x-powered-by"]).toBeUndefined()
    })

    it("gives every response a fresh X-Request-Id", async () => {
        const a = await request(app).get("/api/v1/health")
        const b = await request(app).get("/api/v1/health")
        expect(a.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/)
        expect(a.headers["x-request-id"]).not.toBe(b.headers["x-request-id"])
    })

    it("ignores a request id supplied by the client", async () => {
        const res = await request(app).get("/api/v1/health").set("X-Request-Id", "attacker-chosen")
        expect(res.headers["x-request-id"]).not.toBe("attacker-chosen")
    })
})

describe("CORS", () => {
    it("allows the configured frontend origin and credentials", async () => {
        const res = await request(app).get("/api/v1/health").set("Origin", "http://localhost:3000")
        expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000")
        expect(res.headers["access-control-allow-credentials"]).toBe("true")
    })

    it("does not allow any other origin", async () => {
        const res = await request(app).get("/api/v1/health").set("Origin", "https://evil.example")
        expect(res.headers["access-control-allow-origin"]).toBeUndefined()
    })
})

describe("rate limiting", () => {
    // The limiter is switched off while NODE_ENV=test; turn it on for this block only.
    const original = env.NODE_ENV
    afterAll(() => {
        env.NODE_ENV = original
    })

    it("blocks the 21st auth request in the window with 429", async () => {
        env.NODE_ENV = "development"
        const send = () => request(app).post("/api/v1/auth/verify-email").send({ email: "x@example.com", code: "1" })

        for (let i = 0; i < 20; i++) {
            expect((await send()).status).toBe(400)
        }
        const blocked = await send()

        expect(blocked.status).toBe(429)
        expect(blocked.body).toEqual({ message: "Too many attempts, please try again later" })
    })

    it("does not rate limit unrelated routes with the stricter auth limit", async () => {
        env.NODE_ENV = "development"
        for (let i = 0; i < 25; i++) {
            expect((await request(app).get("/api/v1/health")).status).toBe(200)
        }
    })
})
