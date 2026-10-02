import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { eq, sql } from "drizzle-orm"
import { createApp } from "../../src/app.js"
import { db } from "../../src/db/index.js"
import { auditLogsTable, bookingItemsTable, bookingsTable, timeSlotsTable } from "../../src/db/schema.js"
import { createTimeSlot, updateTimeSlot } from "../../src/services/admin/timeSlots.service.js"
import { closeDb, hasTestDb, resetDb } from "../helpers/db.js"
import { createVerifiedUser } from "../helpers/auth.js"
import { api, userWithToken } from "../helpers/admin.js"
import { futureDate, occupy, postBooking, setupWorld } from "../helpers/booking.js"
import { createSeat, createTimeSlot as makeSlot, itemValues } from "../helpers/factories.js"

const app = createApp()
const [D1, D2] = [2, 3].map(futureDate) as [string, string]

const audits = () => db.select().from(auditLogsTable)
const getSlot = async (id: string) => (await db.select().from(timeSlotsTable).where(eq(timeSlotsTable.id, id)))[0]!

describe.skipIf(!hasTestDb)("admin: time slots", () => {
    beforeEach(resetDb)
    afterAll(closeDb)

    describe("GET /admin/time-slots", () => {
        it("lists ALL slots (inactive too) earliest first, with upcoming booking counts", async () => {
            const { token } = await userWithToken("ADMIN")
            const nine = await makeSlot({ startTime: "09:00", endTime: "10:00", displayName: "9-10" })
            await makeSlot({ startTime: "11:00", endTime: "12:00", displayName: "11-12", isActive: false })
            await makeSlot({ startTime: "10:00", endTime: "11:00", displayName: "10-11" })
            const seat = (await createSeat({ seatNumber: "S1" })).id
            await occupy({ seatId: seat, slotId: nine.id, dates: [D1, D2] })

            const res = await api(app, token).get("/admin/time-slots")

            expect(res.body.timeSlots.map((s: { displayName: string }) => s.displayName)).toEqual(["9-10", "10-11", "11-12"])
            expect(res.body.timeSlots.map((s: { upcomingBookings: number }) => s.upcomingBookings)).toEqual([2, 0, 0])
            expect(res.body.timeSlots[2]).toMatchObject({ isActive: false, startTime: "11:00", endTime: "12:00" })
        })
    })

    describe("POST /admin/time-slots", () => {
        it("creates a slot, names it automatically, and audits it", async () => {
            const { token, user } = await userWithToken("ADMIN")

            const res = await api(app, token).post("/admin/time-slots", { startTime: "09:00", endTime: "10:00" })

            expect(res.status).toBe(201)
            expect(res.body).toMatchObject({ displayName: "09:00 - 10:00", startTime: "09:00", endTime: "10:00", isActive: true })
            const [entry] = await audits()
            expect(entry).toMatchObject({ actorId: user.id, action: "SLOT_CREATED", targetType: "TIME_SLOT", targetId: res.body.id })
        })

        it("accepts a custom name, and a new slot appears in the customers' list", async () => {
            const admin = await userWithToken("ADMIN")
            const customer = await userWithToken("USER")
            await api(app, admin.token).post("/admin/time-slots", { startTime: "18:00", endTime: "19:00", displayName: "Evening" })

            const res = await api(app, customer.token).get("/time-slots")

            expect(res.body.timeSlots.map((s: { displayName: string }) => s.displayName)).toEqual(["Evening"])
        })

        it("allows back-to-back slots", async () => {
            const { token } = await userWithToken("ADMIN")
            await api(app, token).post("/admin/time-slots", { startTime: "10:00", endTime: "11:00" })
            expect((await api(app, token).post("/admin/time-slots", { startTime: "11:00", endTime: "12:00" })).status).toBe(201)
            expect((await api(app, token).post("/admin/time-slots", { startTime: "09:00", endTime: "10:00" })).status).toBe(201)
        })

        it.each([
            ["partly overlapping", "10:30", "11:30"],
            ["identical times", "10:00", "11:00"],
            ["inside the other slot", "10:15", "10:45"],
            ["wrapping around it", "09:00", "12:00"],
        ])("refuses a slot %s an active one, naming the slot in the way", async (_label, start, end) => {
            const { token } = await userWithToken("ADMIN")
            await makeSlot({ startTime: "10:00", endTime: "11:00", displayName: "Morning" })

            const res = await api(app, token).post("/admin/time-slots", { startTime: start, endTime: end, displayName: "New" })

            expect(res.status).toBe(409)
            expect(res.body.code).toBe("SLOT_OVERLAP")
            expect(res.body.message).toContain("Morning")
            expect(await audits()).toHaveLength(0)
        })

        it("lets a slot overlap one that is switched off", async () => {
            const { token } = await userWithToken("ADMIN")
            await makeSlot({ startTime: "10:00", endTime: "11:00", displayName: "Old", isActive: false })
            expect((await api(app, token).post("/admin/time-slots", { startTime: "10:30", endTime: "11:30" })).status).toBe(201)
        })

        it("of 6 overlapping slots created at the same moment, exactly one is saved (the database decides)", async () => {
            const { token } = await userWithToken("ADMIN")

            const results = await Promise.all(
                Array.from({ length: 6 }, (_, i) => api(app, token).post("/admin/time-slots", { startTime: "14:00", endTime: "15:00", displayName: `Race ${i}` })),
            )

            // the message shows what really came back, to make any failure here diagnosable
            const seen = JSON.stringify(results.map((r) => `${r.status}${r.body.code ? ":" + r.body.code : ""}${r.status >= 500 ? ":" + r.body.message : ""}`))
            expect(results.filter((r) => r.status === 201), seen).toHaveLength(1)
            expect(results.filter((r) => r.status === 409 && r.body.code === "SLOT_OVERLAP"), seen).toHaveLength(5)
            expect(await db.select().from(timeSlotsTable)).toHaveLength(1)
        })

        it("slot writes take turns: a second admin waits for the first to finish (this prevents database deadlocks)", async () => {
            // Deterministic version of the race above: hold the same lock a slot write takes,
            // and check that a create has to wait for it.
            const admin = await createVerifiedUser({ role: "ADMIN" })
            let release!: () => void
            const gate = new Promise<void>((resolve) => (release = resolve))
            const held = new Promise<void>((resolveHeld) => {
                void db.transaction(async (tx) => {
                    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('tapasya.time_slots.write'))`)
                    resolveHeld()
                    await gate
                })
            })
            await held

            let finished = false
            const create = createTimeSlot(admin.id, { startTime: "09:00", endTime: "10:00" }).then((slot) => {
                finished = true
                return slot
            })
            await new Promise((resolve) => setTimeout(resolve, 400))
            expect(finished).toBe(false) // still waiting for its turn

            release()
            await expect(create).resolves.toMatchObject({ startTime: "09:00" })
        })

        it("refuses a duplicate name", async () => {
            const { token } = await userWithToken("ADMIN")
            await makeSlot({ startTime: "10:00", endTime: "11:00", displayName: "Same" })
            const res = await api(app, token).post("/admin/time-slots", { startTime: "12:00", endTime: "13:00", displayName: "Same" })
            expect(res.status).toBe(409)
            expect(res.body.code).toBe("SLOT_NAME_TAKEN")
        })

        it.each([
            { startTime: "09:00", endTime: "25:00" },
            { startTime: "9:00", endTime: "10:00" },
            { startTime: "10:00", endTime: "10:00" },
            { startTime: "11:00", endTime: "10:00" },
            { startTime: "09:00" },
        ])("rejects invalid times %j with 400", async (body) => {
            const { token } = await userWithToken("ADMIN")
            expect((await api(app, token).post("/admin/time-slots", body)).status).toBe(400)
            expect(await db.select().from(timeSlotsTable)).toHaveLength(0)
        })
    })

    describe("PATCH /admin/time-slots/:id", () => {
        it("renames a slot, even one with upcoming bookings (a name changes nobody's reservation)", async () => {
            const { token } = await userWithToken("ADMIN")
            const { slot, seat } = await setupWorld()
            await occupy({ seatId: seat.id, slotId: slot.id, dates: [D1] })

            const res = await api(app, token).patch(`/admin/time-slots/${slot.id}`, { displayName: "Renamed" })

            expect(res.status).toBe(200)
            expect(res.body.displayName).toBe("Renamed")
            expect((await audits())[0]).toMatchObject({ action: "SLOT_UPDATED", before: { displayName: "10:00 - 11:00" }, after: { displayName: "Renamed" } })
        })

        it("changes the times of a slot nobody has booked", async () => {
            const { token } = await userWithToken("ADMIN")
            const slot = await makeSlot({ startTime: "10:00", endTime: "11:00", displayName: "S" })

            const res = await api(app, token).patch(`/admin/time-slots/${slot.id}`, { endTime: "11:30" })

            expect(res.status).toBe(200)
            expect(res.body).toMatchObject({ startTime: "10:00", endTime: "11:30" })
        })

        it("refuses to change the times when people have booked it, listing them", async () => {
            const { token } = await userWithToken("ADMIN")
            const { slot, seat } = await setupWorld()
            const booking = await occupy({ seatId: seat.id, slotId: slot.id, dates: [D1, D2] })

            const res = await api(app, token).patch(`/admin/time-slots/${slot.id}`, { startTime: "10:30" })

            expect(res.status).toBe(409)
            expect(res.body.code).toBe("SLOT_HAS_BOOKINGS")
            expect(res.body.details.total).toBe(2)
            expect(res.body.details.bookings[0].bookingCode).toBe(booking.bookingCode)
            expect((await getSlot(slot.id)).startTime).toBe("10:00:00")
            expect(await audits()).toHaveLength(0)
        })

        it("refuses to switch off a slot with upcoming bookings, but switches off an empty one", async () => {
            const { token } = await userWithToken("ADMIN")
            const { slot, seat } = await setupWorld()
            const empty = await makeSlot({ startTime: "15:00", endTime: "16:00", displayName: "Empty" })
            await occupy({ seatId: seat.id, slotId: slot.id, dates: [D1] })

            expect((await api(app, token).patch(`/admin/time-slots/${slot.id}`, { isActive: false })).status).toBe(409)
            expect((await api(app, token).patch(`/admin/time-slots/${empty.id}`, { isActive: false })).status).toBe(200)
            expect((await getSlot(empty.id)).isActive).toBe(false)
        })

        it("allows it when the slot's bookings are all in the past or expired", async () => {
            const { token } = await userWithToken("ADMIN")
            const { slot, seat } = await setupWorld()
            await occupy({ seatId: seat.id, slotId: slot.id, dates: [futureDate(-3)] })
            await occupy({ seatId: seat.id, slotId: slot.id, dates: [D1], itemStatus: "HELD", bookingStatus: "PENDING", expiresAt: new Date(Date.now() - 60_000) })

            expect((await api(app, token).patch(`/admin/time-slots/${slot.id}`, { isActive: false })).status).toBe(200)
        })

        it("only today's slots that have not ended count (fixed clock, India time)", async () => {
            const { seat } = await setupWorld()
            const admin = await createVerifiedUser({ role: "ADMIN" })
            const slot = await makeSlot({ startTime: "12:00", endTime: "13:00", displayName: "Noon" })
            await occupy({ seatId: seat.id, slotId: slot.id, dates: ["2099-06-01"] })

            const beforeEnd = new Date("2099-06-01T07:00:00Z") // 12:30 IST, slot still running
            const afterEnd = new Date("2099-06-01T07:45:00Z") // 13:15 IST, slot finished

            await expect(updateTimeSlot(admin.id, slot.id, { isActive: false }, beforeEnd)).rejects.toMatchObject({ code: "SLOT_HAS_BOOKINGS" })
            await expect(updateTimeSlot(admin.id, slot.id, { isActive: false }, afterEnd)).resolves.toMatchObject({ isActive: false })
        })

        it("switching it back on is refused if the time is now taken by another active slot", async () => {
            const { token } = await userWithToken("ADMIN")
            const old = await makeSlot({ startTime: "10:00", endTime: "11:00", displayName: "Old", isActive: false })
            await makeSlot({ startTime: "10:30", endTime: "11:30", displayName: "Current" })

            const res = await api(app, token).patch(`/admin/time-slots/${old.id}`, { isActive: true })

            expect(res.status).toBe(409)
            expect(res.body.code).toBe("SLOT_OVERLAP")
            expect(res.body.message).toContain("Current")
        })

        it("refuses new times that overlap another active slot, but lets a slot keep its own times", async () => {
            const { token } = await userWithToken("ADMIN")
            const a = await makeSlot({ startTime: "09:00", endTime: "10:00", displayName: "A" })
            await makeSlot({ startTime: "10:00", endTime: "11:00", displayName: "B" })

            expect((await api(app, token).patch(`/admin/time-slots/${a.id}`, { endTime: "10:30" })).body.code).toBe("SLOT_OVERLAP")
            expect((await api(app, token).patch(`/admin/time-slots/${a.id}`, { endTime: "10:00", displayName: "A2" })).status).toBe(200)
        })

        it("checks the combined result: moving only the start past the existing end is refused", async () => {
            const { token } = await userWithToken("ADMIN")
            const slot = await makeSlot({ startTime: "10:00", endTime: "11:00", displayName: "S" })
            const res = await api(app, token).patch(`/admin/time-slots/${slot.id}`, { startTime: "11:30" })
            expect(res.status).toBe(400)
            expect(res.body.message).toContain("endTime must be after startTime")
        })

        it("a save that changes nothing is a no-op without an audit entry", async () => {
            const { token } = await userWithToken("ADMIN")
            const slot = await makeSlot({ startTime: "10:00", endTime: "11:00", displayName: "S" })
            const res = await api(app, token).patch(`/admin/time-slots/${slot.id}`, { startTime: "10:00", displayName: "S" })
            expect(res.status).toBe(200)
            expect(await audits()).toHaveLength(0)
        })

        it("404 for an unknown slot, 400 for a malformed id or empty body", async () => {
            const { token } = await userWithToken("ADMIN")
            const slot = await makeSlot()
            expect((await api(app, token).patch("/admin/time-slots/3f8c1f0e-7b1a-4c52-9d3e-0a1b2c3d4e5f", { displayName: "x" })).status).toBe(404)
            expect((await api(app, token).patch("/admin/time-slots/nope", { displayName: "x" })).status).toBe(400)
            expect((await api(app, token).patch(`/admin/time-slots/${slot.id}`, {})).status).toBe(400)
        })

        it("once switched off, customers cannot see or book the slot", async () => {
            const admin = await userWithToken("ADMIN")
            const { slot, seat, token } = await setupWorld()
            await api(app, admin.token).patch(`/admin/time-slots/${slot.id}`, { isActive: false })

            const list = await api(app, token).get("/time-slots")
            const booking = await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D1] })

            expect(list.body.timeSlots).toEqual([])
            expect(booking.status).toBe(404)
        })

        it("a booking that is IN PROGRESS wins the race: the admin waits for it, then sees it and is refused", async () => {
            const admin = await createVerifiedUser({ role: "ADMIN" })
            const { slot, seat, user } = await setupWorld()

            let finish!: () => void
            const gate = new Promise<void>((resolve) => (finish = resolve))
            const started = new Promise<void>((resolveStarted) => {
                void db.transaction(async (tx) => {
                    await tx.select().from(timeSlotsTable).where(eq(timeSlotsTable.id, slot.id)).for("share")
                    resolveStarted()
                    await gate
                    const [booking] = await tx.insert(bookingsTable).values({
                        bookingCode: "TT-RACE0002", userId: user.id, totalAmountPaise: 15000, status: "PENDING", expiresAt: new Date(Date.now() + 600_000),
                    }).returning()
                    await tx.insert(bookingItemsTable).values(itemValues(booking!.id, seat.id, slot.id, D1, { status: "HELD" }))
                })
            })
            await started

            const adminChange = updateTimeSlot(admin.id, slot.id, { isActive: false }) // must wait for the booking
            await new Promise((resolve) => setTimeout(resolve, 300))
            finish()

            await expect(adminChange).rejects.toMatchObject({ code: "SLOT_HAS_BOOKINGS" })
            expect((await getSlot(slot.id)).isActive).toBe(true)
        })
    })
})
