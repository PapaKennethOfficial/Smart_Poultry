const express = require("express")
const router = express.Router()

const { login, register, googleAuth, verifyOTP } = require("../controllers/auth.controller")
const validate = require("../middleware/validate")
const { loginSchema, registerSchema } = require("../validators/authValidator")

// Public routes — no auth middleware (per spec)
router.post("/login", validate(loginSchema), login)
router.post("/login/verify", verifyOTP)
router.post("/register", validate(registerSchema), register)
router.post("/google", googleAuth)

module.exports = router
