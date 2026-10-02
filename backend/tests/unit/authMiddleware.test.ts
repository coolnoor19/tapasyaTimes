import { describe, expect, it, vi } from "vitest"
import type { Request, Response } from "express"
import { env } from "../../src/config/env.js"
import { authorize } from "../../src/middlewares/authorize.js"
import { requireTrustedOrigin } from "../../src/middlewares/requireTrustedOrigin.js"
import { clearRefreshCookie, setRefreshCookie } from "../../src/utils/refreshCookie.js"

const run = (middleware: (req: Request, res: Response, next: (err?: unknown) => void) => void, req: Partial<Request>) => {
    const next = vi.fn()
    middleware(req as Request, {} as Response, next)
    return next.mock.calls[0]?.[0] as { statusCode?: number; code?: string } | undefined
}

describe("authorize", () => {
    it("returns 401 when nobody is authenticated", () => {
        expect(run(authorize("ADMIN"), {})).toMatchObject({ statusCode: 401 })
    })

    it("returns 403 for a role that is not allowed", () => {
        expect(run(authorize("ADMIN"), { user: { id: "1", role: "USER" } })).toMatchObject({ statusCode: 403, code: "FORBIDDEN" })
    })

    it("lets an allowed role through", () => {
        expect(run(authorize("ADMIN", "MANAGER"), { user: { id: "1", role: "MANAGER" } })).toBeUndefined()
    })

    it("is not hierarchical: ADMIN-only does not admit MANAGER, and MANAGER-only does not admit ADMIN", () => {
        expect(run(authorize("ADMIN"), { user: { id: "1", role: "MANAGER" } })).toMatchObject({ statusCode: 403 })
        expect(run(authorize("MANAGER"), { user: { id: "1", role: "ADMIN" } })).toMatchObject({ statusCode: 403 })
    })
})

describe("requireTrustedOrigin", () => {
    it("allows requests without an Origin header (non-browser clients)", () => {
        expect(run(requireTrustedOrigin, { headers: {} })).toBeUndefined()
    })

    it("allows the configured frontend origin", () => {
        expect(run(requireTrustedOrigin, { headers: { origin: env.CORS_ORIGINS[0]! } })).toBeUndefined()
    })

    it("rejects any other origin with 403", () => {
        expect(run(requireTrustedOrigin, { headers: { origin: "https://evil.example" } })).toMatchObject({ statusCode: 403 })
    })
})

describe("refresh cookie options", () => {
    const capture = () => {
        const calls: { name: string; value?: string; options: Record<string, unknown> }[] = []
        const res = {
            cookie: (name: string, value: string, options: Record<string, unknown>) => calls.push({ name, value, options }),
            clearCookie: (name: string, options: Record<string, unknown>) => calls.push({ name, options }),
        }
        return { res: res as unknown as Response, calls }
    }

    it("is httpOnly, SameSite=Strict, scoped to the auth routes and lasts 30 days", () => {
        const { res, calls } = capture()
        setRefreshCookie(res, "token")
        expect(calls[0]!.options).toMatchObject({
            httpOnly: true,
            sameSite: "strict",
            path: "/api/v1/auth",
            maxAge: 30 * 24 * 60 * 60 * 1000,
        })
    })

    it("is only sent over HTTPS in production", () => {
        const original = env.NODE_ENV
        try {
            env.NODE_ENV = "production"
            const { res, calls } = capture()
            setRefreshCookie(res, "token")
            expect(calls[0]!.options.secure).toBe(true)

            env.NODE_ENV = "development"
            const dev = capture()
            setRefreshCookie(dev.res, "token")
            expect(dev.calls[0]!.options.secure).toBe(false)
        } finally {
            env.NODE_ENV = original
        }
    })

    it("clears with the same path so the browser actually removes it", () => {
        const { res, calls } = capture()
        clearRefreshCookie(res)
        expect(calls[0]!.options).toMatchObject({ httpOnly: true, path: "/api/v1/auth" })
    })
})
