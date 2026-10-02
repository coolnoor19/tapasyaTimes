import { and, asc, eq, gt, lt, ne, sql } from "drizzle-orm"
import { db } from "../../db/index.js"
import type { Tx } from "../../db/types.js"
import { timeSlotsTable as slots } from "../../db/schema.js"
import { getPgErrorCode, getUniqueViolation } from "../../utils/dbErrors.js"
import { BadRequestError } from "../../utils/errors/BadRequestError.js"
import { ConflictError } from "../../utils/errors/ConflictError.js"
import { NotFoundError } from "../../utils/errors/NotFoundError.js"
import { recordAudit } from "./audit.service.js"
import { blockedByBookings, changedFields } from "./diff.js"
import { countUpcomingBy, findUpcomingBookings } from "./upcomingBookings.js"

type SlotRow = typeof slots.$inferSelect

const NAME_CONSTRAINT = "time_slots_displayName_unique"
const OVERLAP_CONSTRAINT = "time_slots_no_overlap"
const EXCLUSION_VIOLATION = "23P01"

const hhmm = (time: string) => time.slice(0, 5)

// Slot writes take turns. The database refuses overlapping active slots with an exclusion
// constraint, but when several overlapping inserts run at the SAME moment each one sees the
// others' uncommitted rows and waits for them, so they deadlock (PostgreSQL then kills all but
// one after about a second, which would reach the admin as a 500). Taking this lock first makes
// each write wait its turn and then get a clean "overlaps" answer. Bookings never take it.
// Released automatically when the transaction ends.
async function lockSlotWrites(tx: Tx) {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('tapasya.time_slots.write'))`)
}

const toSlotView = (slot: SlotRow, upcomingBookings?: number) => ({
    id: slot.id,
    displayName: slot.displayName,
    startTime: hhmm(slot.startTime),
    endTime: hhmm(slot.endTime),
    isActive: slot.isActive,
    createdAt: slot.createdAt.toISOString(),
    updatedAt: slot.updatedAt.toISOString(),
    ...(upcomingBookings === undefined ? {} : { upcomingBookings }),
})

// The database refuses overlapping active slots (exclusion constraint); this just
// turns that refusal into a clear message naming the slot in the way.
async function translateError(err: unknown, tx: Pick<Tx, "select"> | typeof db, candidate?: { id?: string; start: string; end: string }) {
    if (getUniqueViolation(err)?.constraint === NAME_CONSTRAINT) {
        return new ConflictError("A time slot with this name already exists", "SLOT_NAME_TAKEN")
    }
    if (getPgErrorCode(err) === EXCLUSION_VIOLATION) {
        let clash = ""
        if (candidate) {
            const [other] = await tx
                .select({ name: slots.displayName })
                .from(slots)
                .where(
                    and(
                        eq(slots.isActive, true),
                        lt(slots.startTime, candidate.end),
                        gt(slots.endTime, candidate.start),
                        candidate.id ? ne(slots.id, candidate.id) : undefined,
                    ),
                )
                .limit(1)
            clash = other ? ` with "${other.name}"` : ""
        }
        return new ConflictError(`This time overlaps${clash}. Active time slots must not overlap.`, "SLOT_OVERLAP")
    }
    return undefined
}

export async function listTimeSlots(now: Date = new Date()) {
    const [rows, upcoming] = await Promise.all([
        db.select().from(slots).orderBy(asc(slots.startTime), asc(slots.displayName)),
        countUpcomingBy("timeSlot", now),
    ])
    return { timeSlots: rows.map((slot) => toSlotView(slot, upcoming.get(slot.id) ?? 0)) }
}

export async function createTimeSlot(
    actorId: string,
    input: { startTime: string; endTime: string; displayName?: string | undefined },
) {
    const displayName = input.displayName ?? `${input.startTime} - ${input.endTime}`
    try {
        return await db.transaction(async (tx) => {
            await lockSlotWrites(tx)
            const [slot] = await tx
                .insert(slots)
                .values({ startTime: input.startTime, endTime: input.endTime, displayName })
                .returning()
            await recordAudit(tx, {
                actorId,
                action: "SLOT_CREATED",
                targetType: "TIME_SLOT",
                targetId: slot!.id,
                after: { displayName, startTime: input.startTime, endTime: input.endTime, isActive: true },
            })
            return toSlotView(slot!, 0)
        })
    } catch (err) {
        const translated = await translateError(err, db, { start: input.startTime, end: input.endTime })
        throw translated ?? err
    }
}

export async function updateTimeSlot(
    actorId: string,
    slotId: string,
    patch: { startTime?: string | undefined; endTime?: string | undefined; displayName?: string | undefined; isActive?: boolean | undefined },
    now: Date = new Date(),
) {
    // Compared as HH:MM, because the database returns HH:MM:SS
    let candidate: { id: string; start: string; end: string } | undefined
    try {
        return await db.transaction(async (tx) => {
            await lockSlotWrites(tx) // always before the row lock, so every writer locks in the same order
            // FOR UPDATE: waits for any booking in progress on this slot (they share-lock it)
            const [slot] = await tx.select().from(slots).where(eq(slots.id, slotId)).for("update")
            if (!slot) throw new NotFoundError("Time slot not found")

            const current = { ...slot, startTime: hhmm(slot.startTime), endTime: hhmm(slot.endTime) }
            const { changes, before } = changedFields(current, patch)
            if (Object.keys(changes).length === 0) return toSlotView(slot)

            const start = changes.startTime ?? current.startTime
            const end = changes.endTime ?? current.endTime
            if (end <= start) throw new BadRequestError("endTime must be after startTime")
            candidate = { id: slot.id, start, end }

            // Changing when a slot runs, or switching it off, affects people who already booked it.
            const timesChange = changes.startTime !== undefined || changes.endTime !== undefined
            const switchingOff = slot.isActive && changes.isActive === false
            if (timesChange || switchingOff) {
                const upcoming = await findUpcomingBookings(tx, { timeSlotId: slot.id }, now)
                if (upcoming.total > 0) throw blockedByBookings("SLOT_HAS_BOOKINGS", `Time slot "${slot.displayName}"`, upcoming)
            }

            const [updated] = await tx.update(slots).set(changes).where(eq(slots.id, slot.id)).returning()
            await recordAudit(tx, {
                actorId,
                action: "SLOT_UPDATED",
                targetType: "TIME_SLOT",
                targetId: slot.id,
                before,
                after: changes,
            })
            return toSlotView(updated!)
        })
    } catch (err) {
        const translated = await translateError(err, db, candidate)
        throw translated ?? err
    }
}
