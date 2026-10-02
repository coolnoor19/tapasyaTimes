import { asc, eq } from "drizzle-orm"
import { db } from "../db/index.js"
import { timeSlotsTable } from "../db/schema.js"

// Active slots only, earliest first. Inactive slots cannot be booked, so they are not offered.
export async function listActiveTimeSlots() {
    const slots = await db
        .select()
        .from(timeSlotsTable)
        .where(eq(timeSlotsTable.isActive, true))
        .orderBy(asc(timeSlotsTable.startTime), asc(timeSlotsTable.displayName))

    return slots.map((slot) => ({
        id: slot.id,
        displayName: slot.displayName,
        startTime: slot.startTime.slice(0, 5),
        endTime: slot.endTime.slice(0, 5),
    }))
}
