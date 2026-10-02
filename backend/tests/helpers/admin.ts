import type { Express } from "express"
import request from "supertest"
import { createVerifiedUser } from "./auth.js"
import { tokenFor } from "./booking.js"

type Role = "ADMIN" | "MANAGER" | "USER"

export async function userWithToken(role: Role = "USER", overrides: Parameters<typeof createVerifiedUser>[0] = {}) {
    const user = await createVerifiedUser({ role, ...overrides })
    return { user, token: await tokenFor(user.id) }
}

// Small wrapper so tests read like: await api(app, token).patch("/admin/seats/x", { status: "MAINTENANCE" })
export function api(app: Express, token?: string) {
    const auth = <T extends request.Test>(req: T) => (token === undefined ? req : req.set("Authorization", `Bearer ${token}`))
    const base = "/api/v1"
    return {
        get: (path: string) => auth(request(app).get(base + path)),
        post: (path: string, body?: object) => auth(request(app).post(base + path)).send(body ?? {}),
        patch: (path: string, body?: object) => auth(request(app).patch(base + path)).send(body ?? {}),
        put: (path: string, body?: object) => auth(request(app).put(base + path)).send(body ?? {}),
    }
}
