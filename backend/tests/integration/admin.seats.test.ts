import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { count, eq } from "drizzle-orm"
import { createApp } from "../../src/app.js"
import { db } from "../../src/db/index.js"
import { auditLogsTable, bookingItemsTable, bookingsTable, seatsTable } from "../../src/db/schema.js"
import { updateSeat } from "../../src/services/admin/seats.service.js"
import { closeDb, hasTestDb, resetDb } from "../helpers/db.js"
import { createVerifiedUser } from "../helpers/auth.js"
import { api, userWithToken } from "../helpers/admin.js"
import { futureDate, occupy, postBooking, setupWorld } from "../helpers/booking.js"
import { createSeat, createTimeSlot, itemValues } from "../helpers/factories.js"

const app = createApp()
const [D1, D2] = [2, 3].map(futureDate) as [string, string]

const audits = () => db.select().from(auditLogsTable)
const getSeat = async (id: string) => (await db.select().from(seatsTable).where(eq(seatsTable.id, id)))[0]!

describe.skipIf(!hasTestDb)("admin: seats", () => {
    beforeEach(resetDb)
    afterAll(closeDb)

    describe("GET /admin/seats", () => {
        it("lists every seat in seat-number order, with how many upcoming bookings each has", async () => {
            const { token } = await userWithToken("ADMIN")
            const slot = await createTimeSlot()
            const a2 = await createSeat({ seatNumber: "A02" })
            await createSeat({ seatNumber: "A01" })
            await occupy({ seatId: a2.id, slotId: slot.id, dates: [D1, D2] })

            const res = await api(app, token).get("/admin/seats")

            expect(res.status).toBe(200)
            expect(res.body.seats.map((s: { seatNumber: string }) => s.seatNumber)).toEqual(["A01", "A02"])
            expect(res.body.seats.map((s: { upcomingBookings: number }) => s.upcomingBookings)).toEqual([0, 2])
            expect(res.headers["cache-control"]).toBe("no-store")
        })

        it("filters by status and by category", async () => {
            const { token } = await userWithToken("ADMIN")
            await createSeat({ seatNumber: "A01", seatType: "EXECUTIVE" })
            await createSeat({ seatNumber: "B01", seatType: "PROFESSIONAL", status: "MAINTENANCE" })
            await createSeat({ seatNumber: "C01", seatType: "STUDY", status: "INACTIVE" })

            const names = async (query: string) =>
                (await api(app, token).get(`/admin/seats${query}`)).body.seats.map((s: { seatNumber: string }) => s.seatNumber)

            expect(await names("?status=MAINTENANCE")).toEqual(["B01"])
            expect(await names("?seatType=STUDY")).toEqual(["C01"])
            expect(await names("?status=AVAILABLE&seatType=EXECUTIVE")).toEqual(["A01"])
            expect((await api(app, token).get("/admin/seats?status=BROKEN")).status).toBe(400)
        })
    })

    describe("POST /admin/seats", () => {
        it("creates an AVAILABLE seat, normalises the number, and writes an audit entry", async () => {
            const { token, user } = await userWithToken("ADMIN")

            const res = await api(app, token).post("/admin/seats", { seatNumber: " d04 ", seatType: "STUDY", floor: 2 })

            expect(res.status).toBe(201)
            expect(res.body).toMatchObject({ seatNumber: "D04", seatType: "STUDY", floor: 2, status: "AVAILABLE", upcomingBookings: 0 })
            const [entry] = await audits()
            expect(entry).toMatchObject({ actorId: user.id, action: "SEAT_CREATED", targetType: "SEAT", targetId: res.body.id })
            expect(entry!.after).toMatchObject({ seatNumber: "D04", floor: 2 })
        })

        it("a new seat shows up on the booking screen straight away", async () => {
            const admin = await userWithToken("ADMIN")
            const slot = await createTimeSlot()
            await api(app, admin.token).post("/admin/seats", { seatNumber: "Z9", seatType: "STUDY", floor: 1 })
            const customer = await userWithToken("USER")

            const res = await api(app, customer.token).get(`/seats/availability?dates=${D1}&timeSlotId=${slot.id}`)

            expect(res.body.seats.map((s: { seatNumber: string }) => s.seatNumber)).toContain("Z9")
        })

        it("refuses a duplicate number (any letter case) with 409 and creates nothing", async () => {
            const { token } = await userWithToken("ADMIN")
            await createSeat({ seatNumber: "A01" })

            const res = await api(app, token).post("/admin/seats", { seatNumber: "a01", seatType: "STUDY", floor: 1 })

            expect(res.status).toBe(409)
            expect(res.body.code).toBe("SEAT_NUMBER_TAKEN")
            expect(await audits()).toHaveLength(0)
        })

        it("two admins creating the same seat at the same moment: exactly one succeeds", async () => {
            const a = await userWithToken("ADMIN")
            const b = await userWithToken("ADMIN")
            const body = { seatNumber: "R1", seatType: "STUDY", floor: 1 }

            const results = await Promise.all([api(app, a.token).post("/admin/seats", body), api(app, b.token).post("/admin/seats", body)])

            expect(results.map((r) => r.status).sort()).toEqual([201, 409])
            expect(await audits()).toHaveLength(1)
        })

        it.each([
            { seatNumber: "", seatType: "STUDY", floor: 1 },
            { seatNumber: "A1", seatType: "VIP", floor: 1 },
            { seatNumber: "A1", seatType: "STUDY", floor: -3 },
            { seatNumber: "A1; DROP TABLE seats", seatType: "STUDY", floor: 1 },
            { seatType: "STUDY", floor: 1 },
        ])("rejects invalid input %j with 400", async (body) => {
            const { token } = await userWithToken("ADMIN")
            expect((await api(app, token).post("/admin/seats", body)).status).toBe(400)
            expect(await audits()).toHaveLength(0)
        })

        it("ignores a client-supplied id, status or timestamps", async () => {
            const { token } = await userWithToken("ADMIN")
            const res = await api(app, token).post("/admin/seats", {
                seatNumber: "K1", seatType: "STUDY", floor: 1, status: "INACTIVE", id: "3f8c1f0e-7b1a-4c52-9d3e-0a1b2c3d4e5f",
            })
            expect(res.body.status).toBe("AVAILABLE")
            expect(res.body.id).not.toBe("3f8c1f0e-7b1a-4c52-9d3e-0a1b2c3d4e5f")
        })
    })

    describe("PATCH /admin/seats/:id (edits)", () => {
        it("changes the number, floor and category, and audits only what changed", async () => {
            const { token } = await userWithToken("ADMIN")
            const seat = await createSeat({ seatNumber: "A01", seatType: "STUDY", floor: 1 })

            const res = await api(app, token).patch(`/admin/seats/${seat.id}`, { seatNumber: "a05", floor: 3, seatType: "STUDY" })

            expect(res.status).toBe(200)
            expect(res.body).toMatchObject({ seatNumber: "A05", floor: 3, seatType: "STUDY" })
            const [entry] = await audits()
            expect(entry).toMatchObject({ action: "SEAT_UPDATED", before: { seatNumber: "A01", floor: 1 }, after: { seatNumber: "A05", floor: 3 } })
            expect(entry!.after).not.toHaveProperty("seatType") // unchanged, so not logged
        })

        it("a save that changes nothing succeeds without touching the audit log", async () => {
            const { token } = await userWithToken("ADMIN")
            const seat = await createSeat({ seatNumber: "A01", floor: 1 })
            const res = await api(app, token).patch(`/admin/seats/${seat.id}`, { seatNumber: "A01", floor: 1 })
            expect(res.status).toBe(200)
            expect(await audits()).toHaveLength(0)
        })

        it("refuses a number that another seat already has", async () => {
            const { token } = await userWithToken("ADMIN")
            await createSeat({ seatNumber: "A01" })
            const other = await createSeat({ seatNumber: "A02" })

            const res = await api(app, token).patch(`/admin/seats/${other.id}`, { seatNumber: "A01" })

            expect(res.status).toBe(409)
            expect(res.body.code).toBe("SEAT_NUMBER_TAKEN")
            expect((await getSeat(other.id)).seatNumber).toBe("A02")
        })

        it("renaming a seat keeps its bookings (they point to the seat, not the name)", async () => {
            const { token } = await userWithToken("ADMIN")
            const { seat, slot, token: customer } = await setupWorld()
            const booking = await postBooking(app, customer, { seatId: seat.id, timeSlotId: slot.id, dates: [D1] })

            await api(app, token).patch(`/admin/seats/${seat.id}`, { seatNumber: "NEW1" })

            const view = await api(app, customer).get(`/bookings/${booking.body.id}`)
            expect(view.body.seat.seatNumber).toBe("NEW1")
        })

        it("404 for an unknown seat, 400 for a malformed id or an empty body, and unknown fields are ignored", async () => {
            const { token } = await userWithToken("ADMIN")
            const seat = await createSeat({ seatNumber: "A01" })

            expect((await api(app, token).patch("/admin/seats/3f8c1f0e-7b1a-4c52-9d3e-0a1b2c3d4e5f", { floor: 2 })).status).toBe(404)
            expect((await api(app, token).patch("/admin/seats/not-an-id", { floor: 2 })).status).toBe(400)
            expect((await api(app, token).patch(`/admin/seats/${seat.id}`, {})).status).toBe(400)
            expect((await api(app, token).patch(`/admin/seats/${seat.id}`, { id: "x", createdAt: "x" })).status).toBe(400)
        })
    })

    describe("taking a seat out of service (the agreed policy: never silently)", () => {
        it.each(["MAINTENANCE", "INACTIVE"] as const)("is BLOCKED with a list of the bookings in the way when the seat is booked ahead (%s)", async (status) => {
            const { token } = await userWithToken("ADMIN")
            const { seat, slot } = await setupWorld()
            const booking = await occupy({ seatId: seat.id, slotId: slot.id, dates: [D1, D2] })

            const res = await api(app, token).patch(`/admin/seats/${seat.id}`, { status })

            expect(res.status).toBe(409)
            expect(res.body.code).toBe("SEAT_HAS_BOOKINGS")
            expect(res.body.details.total).toBe(2)
            expect(res.body.details.bookings).toHaveLength(2)
            expect(res.body.details.bookings[0]).toMatchObject({ bookingCode: booking.bookingCode, date: D1, status: "CONFIRMED", seatNumber: "A01" })
            expect((await getSeat(seat.id)).status).toBe("AVAILABLE") // unchanged
            expect(await audits()).toHaveLength(0) // a refused change is not logged as a change
        })

        it("an unpaid hold that is still open also blocks it", async () => {
            const { token } = await userWithToken("ADMIN")
            const { seat, slot } = await setupWorld()
            await occupy({
                seatId: seat.id, slotId: slot.id, dates: [D1], itemStatus: "HELD", bookingStatus: "PENDING",
                expiresAt: new Date(Date.now() + 5 * 60_000),
            })
            expect((await api(app, token).patch(`/admin/seats/${seat.id}`, { status: "MAINTENANCE" })).status).toBe(409)
        })

        it.each([
            ["an expired unpaid hold", { itemStatus: "HELD" as const, bookingStatus: "PENDING" as const, expiresAt: new Date(Date.now() - 60_000) }],
            ["a released item", { itemStatus: "RELEASED" as const }],
        ])("is allowed when the only booking is %s", async (_label, extra) => {
            const { token } = await userWithToken("ADMIN")
            const { seat, slot } = await setupWorld()
            await occupy({ seatId: seat.id, slotId: slot.id, dates: [D1], ...extra })

            const res = await api(app, token).patch(`/admin/seats/${seat.id}`, { status: "MAINTENANCE" })

            expect(res.status).toBe(200)
            expect(res.body.status).toBe("MAINTENANCE")
        })

        it("is allowed when the seat only has bookings in the past", async () => {
            const { token } = await userWithToken("ADMIN")
            const { seat, slot } = await setupWorld()
            await occupy({ seatId: seat.id, slotId: slot.id, dates: [futureDate(-5)] })
            expect((await api(app, token).patch(`/admin/seats/${seat.id}`, { status: "INACTIVE" })).status).toBe(200)
        })

        it("only today's bookings that have not finished count (fixed clock, India time)", async () => {
            const { seat } = await setupWorld()
            const morning = await createTimeSlot({ startTime: "08:00", endTime: "09:00", displayName: "8-9" })
            const afternoon = await createTimeSlot({ startTime: "15:00", endTime: "16:00", displayName: "3-4" })
            const admin = await createVerifiedUser({ role: "ADMIN" })
            const now = new Date("2099-06-01T05:30:00Z") // 11:00 IST on 1 June 2099

            await occupy({ seatId: seat.id, slotId: morning.id, dates: ["2099-06-01"] }) // ended at 09:00
            await expect(updateSeat(admin.id, seat.id, { status: "MAINTENANCE" }, now)).resolves.toMatchObject({ status: "MAINTENANCE" })

            await updateSeat(admin.id, seat.id, { status: "AVAILABLE" }, now)
            await occupy({ seatId: seat.id, slotId: afternoon.id, dates: ["2099-06-01"] }) // starts at 15:00
            await expect(updateSeat(admin.id, seat.id, { status: "MAINTENANCE" }, now)).rejects.toMatchObject({ code: "SEAT_HAS_BOOKINGS" })
        })

        it("reports the true total even when only the first 20 bookings are listed", async () => {
            const { token } = await userWithToken("ADMIN")
            const { seat, slot } = await setupWorld()
            const dates = Array.from({ length: 25 }, (_, i) => futureDate(i + 1))
            await occupy({ seatId: seat.id, slotId: slot.id, dates })

            const res = await api(app, token).patch(`/admin/seats/${seat.id}`, { status: "MAINTENANCE" })

            expect(res.body.details.total).toBe(25)
            expect(res.body.details.bookings).toHaveLength(20)
            expect(res.body.message).toContain("showing the first 20")
        })

        it("an empty seat can be put into maintenance and brought back, even with the history of old bookings", async () => {
            const { token } = await userWithToken("ADMIN")
            const { seat } = await setupWorld()

            expect((await api(app, token).patch(`/admin/seats/${seat.id}`, { status: "MAINTENANCE" })).status).toBe(200)
            expect((await api(app, token).patch(`/admin/seats/${seat.id}`, { status: "INACTIVE" })).status).toBe(200)
            expect((await api(app, token).patch(`/admin/seats/${seat.id}`, { status: "AVAILABLE" })).status).toBe(200)
            expect((await audits()).map((a) => a.action)).toEqual(["SEAT_UPDATED", "SEAT_UPDATED", "SEAT_UPDATED"])
        })

        it("bringing a seat back is always allowed, even if it has bookings", async () => {
            const { token } = await userWithToken("ADMIN")
            const { seat, slot } = await setupWorld()
            await db.update(seatsTable).set({ status: "MAINTENANCE" }).where(eq(seatsTable.id, seat.id))
            await occupy({ seatId: seat.id, slotId: slot.id, dates: [D1] })

            expect((await api(app, token).patch(`/admin/seats/${seat.id}`, { status: "AVAILABLE" })).status).toBe(200)
        })

        it("once in maintenance, the seat can no longer be booked and shows as MAINTENANCE", async () => {
            const admin = await userWithToken("ADMIN")
            const { seat, slot, token } = await setupWorld()
            await api(app, admin.token).patch(`/admin/seats/${seat.id}`, { status: "MAINTENANCE" })

            const booking = await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D1] })
            const view = await api(app, token).get(`/seats/availability?dates=${D1}&timeSlotId=${slot.id}`)

            expect(booking.status).toBe(409)
            expect(booking.body.code).toBe("SEAT_UNAVAILABLE")
            expect(view.body.seats[0].availability).toBe("MAINTENANCE")
        })

        it("a booking that is IN PROGRESS wins the race: the admin waits for it, then sees it and is refused", async () => {
            // Simulates a booking transaction that has locked the seat and is part-way through.
            const admin = await createVerifiedUser({ role: "ADMIN" })
            const { seat, slot, user } = await setupWorld()

            let finish!: () => void
            const gate = new Promise<void>((resolve) => (finish = resolve))
            const started = new Promise<void>((resolveStarted) => {
                void db.transaction(async (tx) => {
                    await tx.select().from(seatsTable).where(eq(seatsTable.id, seat.id)).for("share")
                    resolveStarted()
                    await gate // the booking is "still being created"
                    const booking = await tx.insert(bookingsTable).values({
                        bookingCode: "TT-RACE0001", userId: user.id, totalAmountPaise: 15000, status: "PENDING", expiresAt: new Date(Date.now() + 600_000),
                    }).returning()
                    await tx.insert(bookingItemsTable).values(itemValues(booking[0]!.id, seat.id, slot.id, D1, { status: "HELD" }))
                })
            })
            await started

            const adminChange = updateSeat(admin.id, seat.id, { status: "MAINTENANCE" }) // must wait
            await new Promise((resolve) => setTimeout(resolve, 300))
            finish()

            await expect(adminChange).rejects.toMatchObject({ code: "SEAT_HAS_BOOKINGS" })
            expect((await getSeat(seat.id)).status).toBe("AVAILABLE")
        })

        it("conversely, an admin change in progress makes a booking wait, and then it is refused", async () => {
            const { seat, slot, token } = await setupWorld()

            let finish!: () => void
            const gate = new Promise<void>((resolve) => (finish = resolve))
            const started = new Promise<void>((resolveStarted) => {
                void db.transaction(async (tx) => {
                    await tx.select().from(seatsTable).where(eq(seatsTable.id, seat.id)).for("update")
                    resolveStarted()
                    await gate
                    await tx.update(seatsTable).set({ status: "MAINTENANCE" }).where(eq(seatsTable.id, seat.id))
                })
            })
            await started

            const booking = postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D1] }) // must wait
            await new Promise((resolve) => setTimeout(resolve, 300))
            finish()

            const res = await booking
            expect(res.status).toBe(409)
            expect(res.body.code).toBe("SEAT_UNAVAILABLE")
            expect((await db.select({ n: count() }).from(bookingsTable))[0]!.n).toBe(0)
        })
    })
})
