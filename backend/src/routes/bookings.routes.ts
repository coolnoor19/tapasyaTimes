import express from "express"
import { authenticate } from "../middlewares/authenticate.js"
import { validate, validateParams, validateQuery } from "../middlewares/validate.js"
import {
    bookingIdParamSchema,
    createBookingSchema,
    listBookingsQuerySchema,
} from "../validators/booking.validator.js"
import { createBookingHandler, getBookingHandler, listBookingsHandler } from "../controllers/bookings.controller.js"

export const router = express.Router()

// Every booking route needs a logged-in user.
router.use(authenticate)

router.post('/', validate(createBookingSchema), createBookingHandler)
router.get('/', validateQuery(listBookingsQuerySchema), listBookingsHandler)
router.get('/:id', validateParams(bookingIdParamSchema), getBookingHandler)
