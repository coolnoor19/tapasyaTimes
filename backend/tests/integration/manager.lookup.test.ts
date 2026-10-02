import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { createApp } from "../../src/app.js"
import { db } from "../../src/db/index.js"
import { bookingItemsTable } from "../../src/db/schema.js"
import { api, userWithToken } from "../helpers/admin.js"
import { createVerifiedUser } from "../helpers/auth.js"
import { futureDate, occupy } from "../helpers/booking.js"
import { closeDb, hasTestDb, resetDb } from "../helpers/db.js"
import { createBooking, createSeat, createTimeSlot, itemValues } from "../helpers/factories.js"

const app = createApp()
const [D1, D2, D3] = [2, 3, 4].map(futureDate) as [string, string, string]
const MISSING_ID = "3f8c1f0e-7b1a-4c52-9d3e-0a1b2c3d4e5f"

type B = { id: string; bookingCode: string; status: string; holdExpired: boolean; customer: Record<string, string>; items: { date: string }[] }

async function get(path: string) {
    const { token } = await userWithToken("MANAGER")
    return api(app, token).get(path)
}
const ids = (res: { body: { data: { id: string }[] } }) => res.body.data.map((row) => row.id)

describe.skipIf(!hasTestDb)("manager booking lookup", () => {
    beforeEach(resetDb)
    afterAll(closeDb)

    async function world() {
        const slot = await createTimeSlot({ startTime: "09:00", endTime: "10:00" })
        const slot2 = await createTimeSlot({ startTime: "10:00", endTime: "11:00" })
        const seatA = await createSeat({ seatNumber: "A1" })
        const seatB = await createSeat({ seatNumber: "B1" })
        const asha = await createVerifiedUser({ firstName: "Asha", lastName: "Rao", email: "asha.rao@example.com", phone: "9811111111" })
        const ravi = await createVerifiedUser({ firstName: "Ravi", lastName: "Kumar", email: "ravi@example.com", phone: "9822222222" })
        return { slot, slot2, seatA, seatB, asha, ravi }
    }

    describe("GET /manager/bookings", () => {
        it("is empty when there are no bookings", async () => {
            const res = await get("/manager/bookings")
            expect(res.body).toEqual({ data: [], page: 1, limit: 20, total: 0 })
        })

        it("lists every customer's bookings, newest first, each with the customer's details", async () => {
            const { slot, seatA, seatB, asha, ravi } = await world()
            const first = await occupy({ seatId: seatA.id, slotId: slot.id, dates: [D1], userId: asha.id })
            const second = await occupy({ seatId: seatB.id, slotId: slot.id, dates: [D1], userId: ravi.id })

            const res = await get("/manager/bookings")

            expect(ids(res)).toEqual([second.id, first.id])
            expect(res.body.total).toBe(2)
            expect(res.body.data[1].customer).toEqual({
                id: asha.id,
                firstName: "Asha",
                lastName: "Rao",
                email: "asha.rao@example.com",
                phone: "9811111111",
            })
            expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash|\$2[aby]\$|not-a-real-hash/)
        })

        it("finds a booking by its code, ignoring case and spaces; unknown code gives an empty list", async () => {
            const { slot, seatA, asha } = await world()
            const booking = await occupy({ seatId: seatA.id, slotId: slot.id, dates: [D1], userId: asha.id })

            const hit = await get(`/manager/bookings?code=${encodeURIComponent(`  ${booking.bookingCode.toLowerCase()} `)}`)
            const miss = await get("/manager/bookings?code=TT-NOPE")

            expect(ids(hit)).toEqual([booking.id])
            expect(miss.body.data).toEqual([])
        })

        it("filters by status", async () => {
            const { slot, seatA, seatB } = await world()
            const paid = await occupy({ seatId: seatA.id, slotId: slot.id, dates: [D1] })
            await occupy({ seatId: seatB.id, slotId: slot.id, dates: [D1], itemStatus: "RELEASED", bookingStatus: "EXPIRED" })

            expect(ids(await get("/manager/bookings?status=CONFIRMED"))).toEqual([paid.id])
            expect((await get("/manager/bookings?status=EXPIRED")).body.total).toBe(1)
            expect((await get("/manager/bookings?status=CANCELLED")).body.total).toBe(0)
        })

        it("filters by date (bookings that include that day), seat and slot", async () => {
            const { slot, slot2, seatA, seatB } = await world()
            const multi = await occupy({ seatId: seatA.id, slotId: slot.id, dates: [D1, D2] })
            const other = await occupy({ seatId: seatB.id, slotId: slot2.id, dates: [D3] })

            expect(ids(await get(`/manager/bookings?date=${D2}`))).toEqual([multi.id])
            expect(ids(await get(`/manager/bookings?date=${D3}`))).toEqual([other.id])
            expect(ids(await get(`/manager/bookings?seatId=${seatB.id}`))).toEqual([other.id])
            expect(ids(await get(`/manager/bookings?timeSlotId=${slot.id}`))).toEqual([multi.id])
            expect((await get(`/manager/bookings?date=${D2}`)).body.total).toBe(1) // a 2-day booking is ONE booking, not two rows
        })

        it("seat, slot and date must all match the SAME item of a booking, not just any item", async () => {
            const { slot, seatA, seatB, asha } = await world()
            // One booking made of two different items: (A1 on D1) and (B1 on D2).
            const booking = await createBooking(asha.id)
            await db.insert(bookingItemsTable).values([
                itemValues(booking.id, seatA.id, slot.id, D1),
                itemValues(booking.id, seatB.id, slot.id, D2),
            ])

            expect(ids(await get(`/manager/bookings?seatId=${seatA.id}&date=${D1}`))).toEqual([booking.id])
            expect((await get(`/manager/bookings?seatId=${seatA.id}&date=${D2}`)).body.total).toBe(0)
            expect((await get(`/manager/bookings?seatId=${seatB.id}&date=${D1}`)).body.total).toBe(0)
        })

        it("finds bookings by customer name, e-mail or phone, and by customerId", async () => {
            const { slot, seatA, seatB, asha, ravi } = await world()
            const ashas = await occupy({ seatId: seatA.id, slotId: slot.id, dates: [D1], userId: asha.id })
            const ravis = await occupy({ seatId: seatB.id, slotId: slot.id, dates: [D1], userId: ravi.id })

            expect(ids(await get("/manager/bookings?search=asha"))).toEqual([ashas.id])
            expect(ids(await get("/manager/bookings?search=Asha%20Rao"))).toEqual([ashas.id]) // full name
            expect(ids(await get("/manager/bookings?search=RAVI@EXAMPLE"))).toEqual([ravis.id]) // case-insensitive e-mail
            expect(ids(await get("/manager/bookings?search=9822"))).toEqual([ravis.id]) // phone
            expect(ids(await get(`/manager/bookings?customerId=${asha.id}`))).toEqual([ashas.id])
        })

        it("treats % and _ in the search text literally, not as wildcards", async () => {
            const { slot, seatA, asha } = await world()
            await occupy({ seatId: seatA.id, slotId: slot.id, dates: [D1], userId: asha.id })

            expect((await get("/manager/bookings?search=%25%25")).body.total).toBe(0) // "%%" must not match everyone
            expect((await get("/manager/bookings?search=__")).body.total).toBe(0)
            expect((await get("/manager/bookings?search=%27%20OR%20%271%27%3D%271")).body.total).toBe(0)
        })

        it("combines filters (all must hold)", async () => {
            const { slot, seatA, seatB, asha, ravi } = await world()
            await occupy({ seatId: seatA.id, slotId: slot.id, dates: [D1], userId: asha.id })
            await occupy({ seatId: seatB.id, slotId: slot.id, dates: [D1], userId: ravi.id })

            expect((await get(`/manager/bookings?search=asha&seatId=${seatB.id}`)).body.total).toBe(0)
            expect((await get(`/manager/bookings?search=asha&seatId=${seatA.id}&date=${D1}&status=CONFIRMED`)).body.total).toBe(1)
        })

        it("flags an unpaid booking whose payment window has passed (holdExpired), but not a live or paid one", async () => {
            const { slot, slot2, seatA, seatB } = await world()
            const stale = await occupy({
                seatId: seatA.id, slotId: slot.id, dates: [D1], itemStatus: "HELD", bookingStatus: "PENDING", expiresAt: new Date(Date.now() - 60_000),
            })
            const live = await occupy({
                seatId: seatB.id, slotId: slot.id, dates: [D1], itemStatus: "HELD", bookingStatus: "PENDING", expiresAt: new Date(Date.now() + 5 * 60_000),
            })
            const paid = await occupy({ seatId: seatA.id, slotId: slot2.id, dates: [D1] })

            const flags = Object.fromEntries(((await get("/manager/bookings")).body.data as B[]).map((b) => [b.id, b.holdExpired]))

            expect(flags).toEqual({ [stale.id]: true, [live.id]: false, [paid.id]: false })
        })

        it("paginates without repeating or skipping a booking, and reports the total", async () => {
            const { slot, seatA, asha } = await world()
            const dates = [1, 2, 3, 4, 5].map(futureDate)
            for (const date of dates) await occupy({ seatId: seatA.id, slotId: slot.id, dates: [date], userId: asha.id })

            const pages = await Promise.all([1, 2, 3, 4].map((page) => get(`/manager/bookings?page=${page}&limit=2`)))

            expect(pages.map((res) => res.body.data.length)).toEqual([2, 2, 1, 0])
            expect(pages.every((res) => res.body.total === 5)).toBe(true)
            const all = pages.flatMap((res) => ids(res))
            expect(new Set(all).size).toBe(5)
        })

        it("items inside a booking are sorted by date", async () => {
            const { slot, seatA, asha } = await world()
            await occupy({ seatId: seatA.id, slotId: slot.id, dates: [D3, D1, D2], userId: asha.id })

            const [booking] = (await get("/manager/bookings")).body.data as B[]

            expect(booking!.items.map((i) => i.date)).toEqual([D1, D2, D3])
        })

        it.each([
            "page=0", "limit=51", "status=DONE", "code=has%20space", "seatId=1", "date=2026-02-30", "search=a", "customerId=x",
        ])("rejects %s with 400", async (query) => {
            expect((await get(`/manager/bookings?${query}`)).status).toBe(400)
        })
    })

    describe("GET /manager/bookings/:id", () => {
        it("returns any customer's booking with their details", async () => {
            const { slot, seatA, asha } = await world()
            const booking = await occupy({ seatId: seatA.id, slotId: slot.id, dates: [D1], userId: asha.id })

            const res = await get(`/manager/bookings/${booking.id}`)

            expect(res.status).toBe(200)
            expect(res.body).toMatchObject({ id: booking.id, holdExpired: false, customer: { id: asha.id, email: asha.email } })
        })

        it("404 for an unknown id, 400 for a malformed one (never a database error)", async () => {
            expect((await get(`/manager/bookings/${MISSING_ID}`)).status).toBe(404)
            for (const bad of ["123", "not-a-uuid", encodeURIComponent("1' OR '1'='1")]) {
                expect((await get(`/manager/bookings/${bad}`)).status, bad).toBe(400)
            }
        })
    })

    describe("GET /manager/customers", () => {
        it("searches by name, e-mail or phone and shows each customer's booking count (one query for the page)", async () => {
            const { slot, seatA, seatB, asha, ravi } = await world()
            await occupy({ seatId: seatA.id, slotId: slot.id, dates: [D1, D2], userId: asha.id })
            await occupy({ seatId: seatB.id, slotId: slot.id, dates: [D1], userId: asha.id })

            const res = await get("/manager/customers?search=asha")

            expect(res.body.total).toBe(1)
            expect(res.body.data[0]).toMatchObject({ id: asha.id, firstName: "Asha", bookingCount: 2, isVerified: true, status: "ACTIVE" })
            expect((await get("/manager/customers?search=9822")).body.data[0]).toMatchObject({ id: ravi.id, bookingCount: 0 })
        })

        it("shows only what staff need: no role, password hash or lockout data", async () => {
            await world()
            const res = await get("/manager/customers")

            for (const customer of res.body.data) {
                expect(Object.keys(customer).sort()).toEqual(
                    ["bookingCount", "createdAt", "email", "firstName", "id", "isVerified", "lastName", "phone", "status"].sort(),
                )
            }
            expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash|failedLoginAttempts|lockedUntil/)
        })

        it("treats % as a literal character", async () => {
            await world()
            expect((await get("/manager/customers?search=%25%25")).body.total).toBe(0)
        })

        it("paginates", async () => {
            for (let i = 0; i < 5; i++) await createVerifiedUser()
            const [p1, p2, p3] = await Promise.all([1, 2, 3].map((page) => get(`/manager/customers?page=${page}&limit=2`)))
            expect([p1!.body.data.length, p2!.body.data.length, p3!.body.data.length]).toEqual([2, 2, 1])
            expect(p1!.body.total).toBe(5)
        })

        it("lists customers only: managers and admins (including the caller) never appear", async () => {
            await createVerifiedUser({ firstName: "Staffy", role: "ADMIN", email: "boss@example.com" })
            await createVerifiedUser({ firstName: "Staffy", role: "MANAGER", email: "mgr@example.com" })
            const customer = await createVerifiedUser({ firstName: "Staffy", email: "cust@example.com" })

            const res = await get("/manager/customers?search=Staffy")

            expect(ids(res)).toEqual([customer.id])
            expect(JSON.stringify((await get("/manager/customers")).body)).not.toMatch(/boss@example|mgr@example/)
        })

        it("rejects a one-character search with 400", async () => {
            expect((await get("/manager/customers?search=a")).status).toBe(400)
        })
    })

    describe("GET /manager/customers/:id", () => {
        it("shows the customer, their total booking count and only the 10 most recent bookings", async () => {
            const { slot, seatA, asha } = await world()
            for (let day = 1; day <= 12; day++) {
                await occupy({ seatId: seatA.id, slotId: slot.id, dates: [futureDate(day)], userId: asha.id })
            }

            const res = await get(`/manager/customers/${asha.id}`)

            expect(res.status).toBe(200)
            expect(res.body).toMatchObject({ id: asha.id, email: "asha.rao@example.com", bookingCount: 12 })
            expect(res.body.recentBookings).toHaveLength(10)
            expect(res.body.recentBookings.every((b: B) => b.customer.id === asha.id)).toBe(true)
            expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash|not-a-real-hash/)
        })

        it("a customer with no bookings gets an empty history", async () => {
            const { ravi } = await world()
            const res = await get(`/manager/customers/${ravi.id}`)
            expect(res.body).toMatchObject({ bookingCount: 0, recentBookings: [] })
        })

        it("a staff account is not a customer: 404, so an admin's details cannot be read this way", async () => {
            const admin = await createVerifiedUser({ role: "ADMIN" })
            expect((await get(`/manager/customers/${admin.id}`)).status).toBe(404)
        })

        it("404 for an unknown id, 400 for a malformed one", async () => {
            expect((await get(`/manager/customers/${MISSING_ID}`)).status).toBe(404)
            expect((await get("/manager/customers/nope")).status).toBe(400)
        })
    })
})
