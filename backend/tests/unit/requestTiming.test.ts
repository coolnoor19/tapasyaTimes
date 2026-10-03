import { describe, expect, it, vi } from "vitest"
import express from "express"
import request from "supertest"
import { createApp } from "../../src/app.js"
import { requestTiming, type SlowRequest } from "../../src/middlewares/requestTiming.js"

const buildApp = (slowMs: number) => {
    const onSlow = vi.fn<(request: SlowRequest) => void>()
    const app = express()
    app.use(requestTiming({ slowMs, onSlow }))
    app.get("/fast", (_req, res) => res.json({ ok: true }))
    app.get("/slow", async (_req, res) => {
        await new Promise((resolve) => setTimeout(resolve, 40))
        res.status(201).json({ ok: true })
    })
    return { app, onSlow }
}

describe("requestTiming", () => {
    it("adds a Server-Timing header to every answer", async () => {
        const { app } = buildApp(10_000)
        const res = await request(app).get("/fast")
        expect(res.headers["server-timing"]).toMatch(/^total;dur=\d+\.\d$/)
    })

    it("reports a request slower than the limit, without its query string", async () => {
        const { app, onSlow } = buildApp(20)
        await request(app).get("/slow?search=private-name")
        await vi.waitFor(() => expect(onSlow).toHaveBeenCalledTimes(1))
        const reported = onSlow.mock.calls[0]![0]
        expect(reported).toMatchObject({ method: "GET", path: "/slow", status: 201 })
        expect(reported.ms).toBeGreaterThanOrEqual(20)
        expect(JSON.stringify(reported)).not.toContain("private-name")
    })

    it("stays quiet for a request faster than the limit", async () => {
        const { app, onSlow } = buildApp(10_000)
        await request(app).get("/fast")
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(onSlow).not.toHaveBeenCalled()
    })

    it("is wired into the real app", async () => {
        const res = await request(createApp()).get("/api/v1/health")
        expect(res.headers["server-timing"]).toMatch(/^total;dur=\d+\.\d$/)
    })
})
