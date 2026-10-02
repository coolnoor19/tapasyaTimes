import express from "express"
import { authenticate } from "../middlewares/authenticate.js"
import { validateQuery } from "../middlewares/validate.js"
import { availabilityQuerySchema } from "../validators/availability.validator.js"
import { availabilityHandler } from "../controllers/seats.controller.js"

export const router = express.Router()

// authenticate runs first so anonymous callers get 401, not a validation error.
router.get('/availability', authenticate, validateQuery(availabilityQuerySchema), availabilityHandler)
