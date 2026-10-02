import { and, asc, eq } from "drizzle-orm"
import { db } from "../../db/index.js"
import { seatsTable } from "../../db/schema.js"
import { getUniqueViolation } from "../../utils/dbErrors.js"
import { ConflictError } from "../../utils/errors/ConflictError.js"
import { NotFoundError } from "../../utils/errors/NotFoundError.js"
import { recordAudit } from "./audit.service.js"
import { blockedByBookings, changedFields } from "./diff.js"
import { countUpcomingBy, findUpcomingBookings } from "./upcomingBookings.js"

type SeatRow = typeof seatsTable.$inferSelect

const SEAT_NUMBER_CONSTRAINT = "seats_seatNumber_unique"

const toSeatView = (seat: SeatRow, upcomingBookings?: number) => ({
    id: seat.id,
    seatNumber: seat.seatNumber,
    seatType: seat.seatType,
    floor: seat.floor,
    status: seat.status,
    createdAt: seat.createdAt.toISOString(),
    updatedAt: seat.updatedAt.toISOString(),
    ...(upcomingBookings === undefined ? {} : { upcomingBookings }),
})

const seatNumberTaken = () => new ConflictError("A seat with this number already exists", "SEAT_NUMBER_TAKEN")

export async function listSeats(
    filters: { status?: SeatRow["status"] | undefined; seatType?: SeatRow["seatType"] | undefined },
    now: Date = new Date(),
) {
    const [rows, upcoming] = await Promise.all([
        db
            .select()
            .from(seatsTable)
            .where(
                and(
                    filters.status ? eq(seatsTable.status, filters.status) : undefined,
                    filters.seatType ? eq(seatsTable.seatType, filters.seatType) : undefined,
                ),
            )
            .orderBy(asc(seatsTable.seatNumber)),
        countUpcomingBy("seat", now),
    ])
    return { seats: rows.map((seat) => toSeatView(seat, upcoming.get(seat.id) ?? 0)) }
}

export async function createSeat(
    actorId: string,
    input: { seatNumber: string; seatType: SeatRow["seatType"]; floor: number },
) {
    try {
        return await db.transaction(async (tx) => {
            const [seat] = await tx.insert(seatsTable).values(input).returning()
            await recordAudit(tx, {
                actorId,
                action: "SEAT_CREATED",
                targetType: "SEAT",
                targetId: seat!.id,
                after: { seatNumber: seat!.seatNumber, seatType: seat!.seatType, floor: seat!.floor, status: seat!.status },
            })
            return toSeatView(seat!, 0)
        })
    } catch (err) {
        if (getUniqueViolation(err)?.constraint === SEAT_NUMBER_CONSTRAINT) throw seatNumberTaken()
        throw err
    }
}

export async function updateSeat(
    actorId: string,
    seatId: string,
    patch: Partial<Pick<SeatRow, "seatNumber" | "seatType" | "floor" | "status">>,
    now: Date = new Date(),
) {
    try {
        return await db.transaction(async (tx) => {
            // FOR UPDATE: a booking in progress holds a shared lock on this row, so we wait for it
            // to finish and then see its items; and no new booking can start until we commit.
            const [seat] = await tx.select().from(seatsTable).where(eq(seatsTable.id, seatId)).for("update")
            if (!seat) throw new NotFoundError("Seat not found")

            const { changes, before } = changedFields(seat, patch)
            if (Object.keys(changes).length === 0) return toSeatView(seat)

            // Taking a seat out of service never cancels anything silently.
            if (seat.status === "AVAILABLE" && changes.status && changes.status !== "AVAILABLE") {
                const upcoming = await findUpcomingBookings(tx, { seatId: seat.id }, now)
                if (upcoming.total > 0) throw blockedByBookings("SEAT_HAS_BOOKINGS", `Seat ${seat.seatNumber}`, upcoming)
            }

            const [updated] = await tx.update(seatsTable).set(changes).where(eq(seatsTable.id, seat.id)).returning()
            await recordAudit(tx, {
                actorId,
                action: "SEAT_UPDATED",
                targetType: "SEAT",
                targetId: seat.id,
                before,
                after: changes,
            })
            return toSeatView(updated!)
        })
    } catch (err) {
        if (getUniqueViolation(err)?.constraint === SEAT_NUMBER_CONSTRAINT) throw seatNumberTaken()
        throw err
    }
}
