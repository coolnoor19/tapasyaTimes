import express from "express"
import { authenticate } from "../middlewares/authenticate.js"
import { authorize } from "../middlewares/authorize.js"
import { validate, validateParams, validateQuery } from "../middlewares/validate.js"
import { idParamSchema } from "../validators/common.validator.js"
import {
    createSeatSchema,
    createTimeSlotSchema,
    listAuditLogsQuerySchema,
    listSeatsQuerySchema,
    listUsersQuerySchema,
    seatTypeParamSchema,
    updatePriceSchema,
    updateSeatSchema,
    updateTimeSlotSchema,
    updateUserRoleSchema,
    updateUserStatusSchema,
} from "../validators/admin.validator.js"
import {
    createSeatHandler,
    createTimeSlotHandler,
    getUserHandler,
    listAuditLogsHandler,
    listPricesHandler,
    listSeatsHandler,
    listTimeSlotsHandler,
    listUsersHandler,
    setPriceHandler,
    setUserRoleHandler,
    setUserStatusHandler,
    updateSeatHandler,
    updateTimeSlotHandler,
} from "../controllers/admin.controller.js"

export const router = express.Router()

// ONE gate for everything below. Any route added to this file is admin-only automatically,
// so a new endpoint cannot be shipped unprotected by forgetting a check.
router.use(authenticate, authorize("ADMIN"))

// Seats (never deleted: a seat that is out of service is set to INACTIVE, so history stays intact)
router.get('/seats', validateQuery(listSeatsQuerySchema), listSeatsHandler)
router.post('/seats', validate(createSeatSchema), createSeatHandler)
router.patch('/seats/:id', validateParams(idParamSchema), validate(updateSeatSchema), updateSeatHandler)

// Time slots
router.get('/time-slots', listTimeSlotsHandler)
router.post('/time-slots', validate(createTimeSlotSchema), createTimeSlotHandler)
router.patch('/time-slots/:id', validateParams(idParamSchema), validate(updateTimeSlotSchema), updateTimeSlotHandler)

// Hourly price per seat category
router.get('/seat-prices', listPricesHandler)
router.put('/seat-prices/:seatType', validateParams(seatTypeParamSchema), validate(updatePriceSchema), setPriceHandler)

// Users and roles
router.get('/users', validateQuery(listUsersQuerySchema), listUsersHandler)
router.get('/users/:id', validateParams(idParamSchema), getUserHandler)
router.patch('/users/:id/status', validateParams(idParamSchema), validate(updateUserStatusSchema), setUserStatusHandler)
router.patch('/users/:id/role', validateParams(idParamSchema), validate(updateUserRoleSchema), setUserRoleHandler)

// Who changed what
router.get('/audit-logs', validateQuery(listAuditLogsQuerySchema), listAuditLogsHandler)
