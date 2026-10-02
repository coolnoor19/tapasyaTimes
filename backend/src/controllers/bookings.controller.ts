import type { NextFunction, Request, Response } from "express"
import { createBooking, getBooking, listMyBookings } from "../services/booking.service.js"
import { BadRequestError } from "../utils/errors/BadRequestError.js"
import { idempotencyKeySchema } from "../validators/booking.validator.js"

export async function createBookingHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { seatId, timeSlotId, dates } = req.body as { seatId: string; timeSlotId: string; dates: string[] }

        const rawKey = req.header("Idempotency-Key")
        const key = rawKey === undefined ? undefined : idempotencyKeySchema.safeParse(rawKey)
        if (key && !key.success) throw new BadRequestError(key.error.issues[0]!.message)

        const { booking, replayed } = await createBooking({
            userId: req.user!.id,
            seatId,
            timeSlotId,
            dates,
            idempotencyKey: key?.data,
        })

        res.set("Cache-Control", "no-store")
        if (replayed) res.set("Idempotent-Replayed", "true")
        // 201 for a new booking, 200 when a retry gets the original one back.
        res.status(replayed ? 200 : 201).json(booking)
    } catch (err) {
        next(err)
    }
}

export async function getBookingHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = res.locals.params as { id: string }
        res.set("Cache-Control", "no-store")
        res.status(200).json(await getBooking(id, req.user!))
    } catch (err) {
        next(err)
    }
}

export async function listBookingsHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const { page, limit } = res.locals.query as { page: number; limit: number }
        res.set("Cache-Control", "no-store")
        res.status(200).json(await listMyBookings(req.user!.id, page, limit))
    } catch (err) {
        next(err)
    }
}
