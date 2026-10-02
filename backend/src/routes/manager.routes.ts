import express from "express"
import { authenticate } from "../middlewares/authenticate.js"
import { authorize } from "../middlewares/authorize.js"
import { validateParams, validateQuery } from "../middlewares/validate.js"
import { idParamSchema } from "../validators/common.validator.js"
import {
    boardQuerySchema,
    managerBookingsQuerySchema,
    managerCustomersQuerySchema,
    occupancyQuerySchema,
} from "../validators/manager.validator.js"
import {
    boardHandler,
    getBookingHandler,
    getCustomerHandler,
    occupancyHandler,
    searchBookingsHandler,
    searchCustomersHandler,
} from "../controllers/manager.controller.js"

export const router = express.Router()

// ONE gate for everything below (same idea as the admin router). Staff only: roles are exact, so an
// admin is listed explicitly. Every route here is GET: a manager cannot change anything in V1.
router.use(authenticate, authorize("MANAGER", "ADMIN"))

// Today's floor: every slot, every seat, who has it
router.get('/board', validateQuery(boardQuerySchema), boardHandler)

// How full the space is, per day
router.get('/occupancy', validateQuery(occupancyQuerySchema), occupancyHandler)

// Booking lookup (by code, customer, date, seat, slot, status)
router.get('/bookings', validateQuery(managerBookingsQuerySchema), searchBookingsHandler)
router.get('/bookings/:id', validateParams(idParamSchema), getBookingHandler)

// Customer lookup
router.get('/customers', validateQuery(managerCustomersQuerySchema), searchCustomersHandler)
router.get('/customers/:id', validateParams(idParamSchema), getCustomerHandler)
