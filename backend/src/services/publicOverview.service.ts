import { asc, count, eq } from "drizzle-orm"
import { db } from "../db/index.js"
import { seatPricesTable, seatsTable, timeSlotsTable } from "../db/schema.js"

const SEAT_TYPES = ["EXECUTIVE", "PROFESSIONAL", "STUDY"] as const

// What a visitor who is not signed in may see: what the workspace offers and for how much.
// Deliberately small, and only what the public landing page needs: no ids, no bookings, nothing about people.
export async function getPublicOverview() {
    const [priceRows, seatRows, slots] = await Promise.all([
        db.select().from(seatPricesTable),
        // Only seats in service count: a seat under maintenance cannot be booked, so it is not on offer.
        db
            .select({ seatType: seatsTable.seatType, total: count() })
            .from(seatsTable)
            .where(eq(seatsTable.status, "AVAILABLE"))
            .groupBy(seatsTable.seatType),
        db
            .select({ displayName: timeSlotsTable.displayName, startTime: timeSlotsTable.startTime, endTime: timeSlotsTable.endTime })
            .from(timeSlotsTable)
            .where(eq(timeSlotsTable.isActive, true))
            .orderBy(asc(timeSlotsTable.startTime), asc(timeSlotsTable.displayName)),
    ])

    const price = new Map(priceRows.map((row) => [row.seatType, row.pricePerHourPaise]))
    const seats = new Map(seatRows.map((row) => [row.seatType, row.total]))

    return {
        currency: "INR" as const,
        // All three tiers always, in a fixed order. A tier with no price yet has null, not a made-up number.
        tiers: SEAT_TYPES.map((seatType) => ({
            seatType,
            pricePerHourPaise: price.get(seatType) ?? null,
            seatCount: seats.get(seatType) ?? 0,
        })),
        timeSlots: slots.map((slot) => ({
            displayName: slot.displayName,
            startTime: slot.startTime.slice(0, 5),
            endTime: slot.endTime.slice(0, 5),
        })),
    }
}
