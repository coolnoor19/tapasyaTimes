import express from "express"
import { validate } from "../middlewares/validate.js"
import { registerSchema, loginSchema } from "../validators/auth.validator.js"
import { registerUserHandler } from "../controllers/auth.controller.js"

export const router = express.Router()

router.post('/register', validate(registerSchema), registerUserHandler)

router.post('/login', validate(loginSchema), (req, res) => {
    res.status(501).json({ message: "Not implemented" })
})
