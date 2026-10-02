import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import { createApp } from "../../src/app.js"
import { db } from "../../src/db/index.js"
import { auditLogsTable, bookingItemsTable, seatPricesTable } from "../../src/db/schema.js"
import { closeDb, hasTestDb, resetDb } from "../helpers/db.js"
import { api, userWithToken } from "../helpers/admin.js"
import { futureDate, postBooking, setupWorld } from "../helpers/booking.js"

const app = createApp()
const [D1, D2] = [2, 3].map(futureDate) as [string, string]
const audits = () => db.select().from(auditLogsTable)

describe.skipIf(!hasTestDb)("admin: seat prices", () => {
    beforeEach(resetDb)
    afterAll(closeDb)

    it("lists all three categories, showing null for one that has no price yet", async () => {
        const { token } = await userWithToken("ADMIN")
        await db.insert(seatPricesTable).values({ seatType: "STUDY", pricePerHourPaise: 6000 })

        const res = await api(app, token).get("/admin/seat-prices")

        expect(res.status).toBe(200)
        expect(res.body.prices.map((p: { seatType: string }) => p.seatType)).toEqual(["EXECUTIVE", "PROFESSIONAL", "STUDY"])
        expect(res.body.prices.map((p: { pricePerHourPaise: number | null }) => p.pricePerHourPaise)).toEqual([null, null, 6000])
    })

    it("sets a price for a category that had none, and audits it", async () => {
        const { token, user } = await userWithToken("ADMIN")

        const res = await api(app, token).put("/admin/seat-prices/EXECUTIVE", { pricePerHourPaise: 15000 })

        expect(res.status).toBe(200)
        expect(res.body).toMatchObject({ seatType: "EXECUTIVE", pricePerHourPaise: 15000 })
        const [entry] = await audits()
        expect(entry).toMatchObject({ actorId: user.id, action: "PRICE_UPDATED", targetType: "SEAT_PRICE", targetId: "EXECUTIVE", after: { pricePerHourPaise: 15000 } })
        expect(entry!.before).toBeNull()
    })

    it("changes an existing price, recording the old and the new value", async () => {
        const { token } = await userWithToken("ADMIN")
        await db.insert(seatPricesTable).values({ seatType: "STUDY", pricePerHourPaise: 6000 })

        await api(app, token).put("/admin/seat-prices/STUDY", { pricePerHourPaise: 7500 })

        expect((await audits())[0]).toMatchObject({ before: { pricePerHourPaise: 6000 }, after: { pricePerHourPaise: 7500 } })
        expect((await db.select().from(seatPricesTable).where(eq(seatPricesTable.seatType, "STUDY")))[0]!.pricePerHourPaise).toBe(7500)
    })

    it("setting the same price again changes nothing and logs nothing", async () => {
        const { token } = await userWithToken("ADMIN")
        await api(app, token).put("/admin/seat-prices/STUDY", { pricePerHourPaise: 6000 })
        await api(app, token).put("/admin/seat-prices/STUDY", { pricePerHourPaise: 6000 })
        expect(await audits()).toHaveLength(1)
    })

    it("a new price applies to new bookings only; existing bookings keep the price they were sold at", async () => {
        const admin = await userWithToken("ADMIN")
        const { seat, slot, token } = await setupWorld() // EXECUTIVE at 15000
        const before = await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D1] })

        await api(app, admin.token).put("/admin/seat-prices/EXECUTIVE", { pricePerHourPaise: 20000 })
        const after = await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D2] })

        expect(before.body.totalAmountPaise).toBe(15000)
        expect(after.body.totalAmountPaise).toBe(20000)
        const items = await db.select().from(bookingItemsTable)
        expect(items.map((i) => i.amountPaise).sort()).toEqual([15000, 20000])
    })

    it("customers see the new price on the availability screen at once", async () => {
        const admin = await userWithToken("ADMIN")
        const { slot, token } = await setupWorld()
        await api(app, admin.token).put("/admin/seat-prices/EXECUTIVE", { pricePerHourPaise: 18000 })

        const res = await api(app, token).get(`/seats/availability?dates=${D1}&timeSlotId=${slot.id}`)

        expect(res.body.seats[0].pricePerHourPaise).toBe(18000)
    })

    it.each([
        ["zero", 0],
        ["below the Rs 1 minimum", 99],
        ["negative", -500],
        ["above the maximum", 10_000_001],
        ["fractional", 150.5],
        ["text", "15000"],
        ["missing", undefined],
    ])("rejects %s with 400 and changes nothing", async (_label, value) => {
        const { token } = await userWithToken("ADMIN")
        const res = await api(app, token).put("/admin/seat-prices/STUDY", value === undefined ? {} : { pricePerHourPaise: value })
        expect(res.status).toBe(400)
        expect(await db.select().from(seatPricesTable)).toHaveLength(0)
        expect(await audits()).toHaveLength(0)
    })

    it("rejects an unknown category in the URL", async () => {
        const { token } = await userWithToken("ADMIN")
        expect((await api(app, token).put("/admin/seat-prices/VIP", { pricePerHourPaise: 1000 })).status).toBe(400)
        expect((await api(app, token).put("/admin/seat-prices/study", { pricePerHourPaise: 1000 })).status).toBe(400)
    })

    it("the highest allowed price still lets a 31-date booking be created (no overflow)", async () => {
        const admin = await userWithToken("ADMIN")
        const { seat, slot, token } = await setupWorld()
        await api(app, admin.token).put("/admin/seat-prices/EXECUTIVE", { pricePerHourPaise: 10_000_000 })
        const dates = Array.from({ length: 31 }, (_, i) => futureDate(i + 1))

        const res = await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates })

        expect(res.status).toBe(201)
        expect(res.body.totalAmountPaise).toBe(310_000_000)
    })
})
