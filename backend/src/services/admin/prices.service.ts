import { eq } from "drizzle-orm"
import { db } from "../../db/index.js"
import { seatPricesTable as prices } from "../../db/schema.js"
import { recordAudit } from "./audit.service.js"

type SeatType = "EXECUTIVE" | "PROFESSIONAL" | "STUDY"
const SEAT_TYPES: SeatType[] = ["EXECUTIVE", "PROFESSIONAL", "STUDY"]

// Always lists all three categories, so a category with no price yet is visible (null), not missing.
export async function listSeatPrices() {
    const rows = await db.select().from(prices)
    const byType = new Map(rows.map((row) => [row.seatType, row]))
    return {
        prices: SEAT_TYPES.map((seatType) => ({
            seatType,
            pricePerHourPaise: byType.get(seatType)?.pricePerHourPaise ?? null,
            updatedAt: byType.get(seatType)?.updatedAt.toISOString() ?? null,
        })),
    }
}

// A new price applies to FUTURE bookings only: every existing booking item keeps the
// price it was sold at (it is a snapshot).
export async function setSeatPrice(actorId: string, seatType: SeatType, pricePerHourPaise: number) {
    return db.transaction(async (tx) => {
        const [existing] = await tx.select().from(prices).where(eq(prices.seatType, seatType)).for("update")

        const [saved] = await tx
            .insert(prices)
            .values({ seatType, pricePerHourPaise })
            .onConflictDoUpdate({ target: prices.seatType, set: { pricePerHourPaise } })
            .returning()

        if (existing?.pricePerHourPaise !== pricePerHourPaise) {
            await recordAudit(tx, {
                actorId,
                action: "PRICE_UPDATED",
                targetType: "SEAT_PRICE",
                targetId: seatType,
                ...(existing ? { before: { pricePerHourPaise: existing.pricePerHourPaise } } : {}),
                after: { pricePerHourPaise },
            })
        }
        return { seatType, pricePerHourPaise: saved!.pricePerHourPaise, updatedAt: saved!.updatedAt.toISOString() }
    })
}
