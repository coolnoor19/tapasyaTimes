import { afterAll, beforeEach, describe, expect, it } from "vitest"
import request from "supertest"
import { createApp } from "../../src/app.js"
import { closeDb, hasTestDb, resetDb } from "../helpers/db.js"
import { createVerifiedUser } from "../helpers/auth.js"
import { futureDate, postBooking, setupWorld, tokenFor } from "../helpers/booking.js"
import { createSeat } from "../helpers/factories.js"

const app = createApp()
const [D1, D2, D3] = [2, 3, 4].map(futureDate) as [string, string, string]

const get = (path: string, token?: string) => {
    const req = request(app).get(`/api/v1${path}`)
    return token === undefined ? req : req.set("Authorization", `Bearer ${token}`)
}

describe.skipIf(!hasTestDb)("reading bookings", () => {
    beforeEach(resetDb)
    afterAll(closeDb)

    describe("GET /bookings/:id", () => {
        async function bookingOwnedBy() {
            const world = await setupWorld()
            const res = await postBooking(app, world.token, { seatId: world.seat.id, timeSlotId: world.slot.id, dates: [D3, D1] })
            return { ...world, bookingId: res.body.id as string }
        }

        it("shows the owner their booking, items sorted by date, without customer details", async () => {
            const { token, bookingId } = await bookingOwnedBy()

            const res = await get(`/bookings/${bookingId}`, token)

            expect(res.status).toBe(200)
            expect(res.body.id).toBe(bookingId)
            expect(res.body.items.map((i: { date: string }) => i.date)).toEqual([D1, D3])
            expect(res.body.customer).toBeUndefined()
            expect(res.headers["cache-control"]).toBe("no-store")
        })

        it("another customer gets 404, exactly like an id that does not exist (no leak)", async () => {
            const { bookingId } = await bookingOwnedBy()
            const stranger = await tokenFor((await createVerifiedUser()).id)

            const theirs = await get(`/bookings/${bookingId}`, stranger)
            const missing = await get("/bookings/3f8c1f0e-7b1a-4c52-9d3e-0a1b2c3d4e5f", stranger)

            expect(theirs.status).toBe(404)
            expect(theirs.body).toEqual(missing.body)
        })

        it.each(["MANAGER", "ADMIN"] as const)("%s can view any booking, including the customer's details", async (role) => {
            const { user, bookingId } = await bookingOwnedBy()
            const staff = await tokenFor((await createVerifiedUser({ role })).id)

            const res = await get(`/bookings/${bookingId}`, staff)

            expect(res.status).toBe(200)
            expect(res.body.customer).toEqual({
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone: user.phone,
            })
            expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash|\$2[aby]\$/)
        })

        it("requires login", async () => {
            const { bookingId } = await bookingOwnedBy()
            expect((await get(`/bookings/${bookingId}`)).status).toBe(401)
        })

        it.each(["123", "not-a-uuid", "1' OR '1'='1"])("answers 400 (not a database error) for the malformed id %j", async (id) => {
            const { token } = await bookingOwnedBy()
            expect((await get(`/bookings/${encodeURIComponent(id)}`, token)).status).toBe(400)
        })
    })

    describe("GET /bookings (my bookings)", () => {
        it("is empty for a user with no bookings", async () => {
            const { token } = await setupWorld()
            const res = await get("/bookings", token)
            expect(res.status).toBe(200)
            expect(res.body).toEqual({ data: [], page: 1, limit: 20, total: 0 })
        })

        it("lists only my own bookings, newest first", async () => {
            const { seat, slot, token } = await setupWorld()
            const otherSeat = await createSeat({ seatNumber: "A02", seatType: "EXECUTIVE" })
            const stranger = await tokenFor((await createVerifiedUser()).id)
            const first = await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D1] })
            const second = await postBooking(app, token, { seatId: otherSeat.id, timeSlotId: slot.id, dates: [D2] })
            await postBooking(app, stranger, { seatId: seat.id, timeSlotId: slot.id, dates: [D3] })

            const res = await get("/bookings", token)

            expect(res.body.total).toBe(2)
            expect(res.body.data.map((b: { id: string }) => b.id)).toEqual([second.body.id, first.body.id])
            expect(res.body.data[0]).toMatchObject({ seat: { seatNumber: "A02" }, items: [{ date: D2 }] })
        })

        it("paginates", async () => {
            const { slot, token } = await setupWorld()
            const seats = await Promise.all(
                Array.from({ length: 3 }, (_, i) => createSeat({ seatNumber: `P0${i}`, seatType: "EXECUTIVE" })),
            )
            for (const seat of seats) await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D1] })

            const page1 = await get("/bookings?page=1&limit=2", token)
            const page2 = await get("/bookings?page=2&limit=2", token)
            const page3 = await get("/bookings?page=3&limit=2", token)

            expect(page1.body.data).toHaveLength(2)
            expect(page2.body.data).toHaveLength(1)
            expect(page3.body.data).toHaveLength(0)
            expect(page1.body.total).toBe(3)
            const ids = [...page1.body.data, ...page2.body.data].map((b: { id: string }) => b.id)
            expect(new Set(ids).size).toBe(3) // no booking repeated or skipped across pages
        })

        it.each(["page=0", "page=-1", "page=abc", "limit=0", "limit=51", "limit=100000"])("rejects %s with 400", async (query) => {
            const { token } = await setupWorld()
            expect((await get(`/bookings?${query}`, token)).status).toBe(400)
        })

        it("requires login", async () => {
            expect((await get("/bookings")).status).toBe(401)
        })
    })
})
