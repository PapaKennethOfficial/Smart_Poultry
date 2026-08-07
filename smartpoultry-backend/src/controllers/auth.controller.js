const prisma = require("../config/prisma")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const admin = require("../config/firebaseAdmin")
const { sendEmail } = require("../services/email.service")
const { sendSMS } = require("../services/sms.service")

const PUBLIC_REGISTRATION_ROLES = new Set(["CUSTOMER", "DELIVERY"])

function roleCanAccessSignInArea(userRole, requestedRole) {
    if (!requestedRole) return true
    if (requestedRole === "MANAGER") return userRole === "MANAGER" || userRole === "ADMIN"
    return userRole === requestedRole
}

function assertCanRegisterRole(role) {
    if (PUBLIC_REGISTRATION_ROLES.has(role)) return null
    if (role === "MANAGER") return null

    return {
        status: 403,
        message: "This role cannot be self-registered. Ask an administrator to create privileged accounts.",
    }
}

function signToken(user) {
    if (!process.env.JWT_SECRET) {
        const err = new Error("JWT secret is not configured")
        err.status = 500
        throw err
    }

    return jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    )
}

const login = async (req, res, next) => {
    try {
        const { email, password, role } = req.body

        const user = await prisma.user.findUnique({
            where: { email }
        })

        // Use the same message for both cases to prevent user enumeration
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: "Invalid credentials" })
        }

        if (!roleCanAccessSignInArea(user.role, role)) {
            return res.status(403).json({
                message: "This account does not have access to the selected sign-in area.",
            })
        }

        if (false /* user.isTwoFactorEnabled - Disabled per user request */) {
            // Generate a 6 digit OTP
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
            const otpExpiry = new Date(Date.now() + 10 * 60000) // 10 minutes from now

            await prisma.user.update({
                where: { id: user.id },
                data: { otpCode, otpExpiry }
            })

            // Send real email or SMS
            const messageBody = `Your SmartPoultry OTP code is: ${otpCode}. It expires in 10 minutes.`
            try {
                if (user.phone) {
                    await sendSMS(user.phone, messageBody)
                } else if (user.email) {
                    await sendEmail(user.email, "Your Login OTP", `<p>${messageBody}</p>`)
                }
            } catch (err) {
                console.error("Failed to send 2FA OTP:", err)
                // Continue anyway so they can at least see the mock otp in response if dev mode
            }

            return res.status(200).json({
                message: "OTP sent to your email/phone",
                requires2FA: true,
                userId: user.id,
                mockOtp: process.env.NODE_ENV === 'development' ? otpCode : undefined // Only expose in dev
            })
        }

        const token = signToken(user)

        // Stamp last login — fire-and-forget; never block the response on this.
        prisma.user
            .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
            .catch((e) => console.error("[login] failed to stamp lastLoginAt:", e.message))

        // Strip the password hash before returning the user object
        const { password: _pw, ...safeUser } = user

        res.status(200).json({
            message: "Login successful",
            token,
            role: user.role,
            user: safeUser,
        })

    } catch (error) {
        next(error) // delegate to global errorHandler
    }
}

const register = async (req, res, next) => {
    try {
        const { name, email, password, phone, role } = req.body
        const requestedRole = role || "CUSTOMER"

        const roleRegistrationError = assertCanRegisterRole(requestedRole)
        if (roleRegistrationError) {
            return res.status(roleRegistrationError.status).json({
                message: roleRegistrationError.message,
            })
        }

        const existing = await prisma.user.findUnique({ where: { email } })
        if (existing) {
            return res.status(409).json({ message: "Email already registered" })
        }

        const hashed = await bcrypt.hash(password, 10)

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashed,
                phone: phone || null,
                role: requestedRole,
                deliveryStaffStatus: requestedRole === "DELIVERY" ? "PENDING" : null,
            },
        })

        const { password: _pw, ...safeUser } = user

        const token = signToken(user)

        res.status(201).json({
            message: "Account created successfully",
            token,
            role: user.role,
            user: safeUser,
        })

    } catch (error) {
        next(error)
    }
}

const googleAuth = async (req, res, next) => {
    try {
        const { token: idToken, role } = req.body
        const requestedRole = role || "CUSTOMER"

        if (!idToken) return res.status(400).json({ message: "Firebase ID token is required" })
        if (!admin.apps.length) {
            return res.status(503).json({
                message: "Firebase authentication is not configured on the server.",
            })
        }
        if (!PUBLIC_REGISTRATION_ROLES.has(requestedRole)) {
            return res.status(403).json({
                message: "This role cannot be self-registered with Google sign-in.",
            })
        }

        // 1. Verify token with Firebase Admin. Never mock users here: a failed
        // Firebase verification must not become a successful app login.
        let decodedToken
        try {
            decodedToken = await admin.auth().verifyIdToken(idToken)
        } catch (err) {
            return res.status(401).json({ message: "Invalid Firebase token" })
        }

        const email = decodedToken.email
        if (!email) return res.status(400).json({ message: "Firebase account has no email address" })

        const name = decodedToken.name || email.split('@')[0]

        // 2. Find or create user
        let user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    name,
                    email,
                    password: "", // No password for OAuth
                    role: requestedRole,
                    deliveryStaffStatus: requestedRole === "DELIVERY" ? "PENDING" : null,
                }
            })
        } else if (user.role !== requestedRole) {
            // A Google account is bound to one SmartPoultry role. If the user
            // hits the Customer tab but their account was created via the
            // Delivery tab (or vice versa), refuse the login rather than
            // silently signing them in to the wrong dashboard. Give them a
            // clear next step so they can pick the correct tab.
            const roleLabel = { CUSTOMER: "Customer", DELIVERY: "Delivery Staff", MANAGER: "Manager", ADMIN: "Admin" }
            return res.status(403).json({
                message:
                    `This Google account is registered as a ${roleLabel[user.role] || user.role} account. ` +
                    `Please sign in via the ${roleLabel[user.role] || user.role} tab instead.`,
                registeredRole: user.role,
            })
        }

        // 3. Generate internal JWT
        const token = signToken(user)

        prisma.user
            .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
            .catch((e) => console.error("[googleAuth] failed to stamp lastLoginAt:", e.message))

        const { password: _pw, ...safeUser } = user

        res.status(200).json({
            message: "Google login successful",
            token,
            role: user.role,
            user: safeUser,
        })

    } catch (error) {
        next(error)
    }
}

const verifyOTP = async (req, res, next) => {
    try {
        const { userId, otpCode } = req.body

        const user = await prisma.user.findUnique({ where: { id: userId } })
        if (!user) return res.status(404).json({ message: "User not found" })

        if (user.otpCode !== otpCode || !user.otpExpiry || user.otpExpiry < new Date()) {
            return res.status(401).json({ message: "Invalid or expired OTP" })
        }

        // Clear OTP and login
        await prisma.user.update({
            where: { id: user.id },
            data: { otpCode: null, otpExpiry: null, lastLoginAt: new Date() }
        })

        const token = signToken(user)
        const { password: _pw, ...safeUser } = user

        res.status(200).json({
            message: "Login successful",
            token,
            role: user.role,
            user: safeUser,
        })
    } catch (error) {
        next(error)
    }
}

const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body
        const user = await prisma.user.findUnique({ where: { email } })
        
        if (!user) {
            // Return success even if user not found to prevent enumeration
            return res.status(200).json({ message: "If an account exists, an OTP has been sent." })
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString()
        const otpExpiry = new Date(Date.now() + 10 * 60000)

        await prisma.user.update({
            where: { id: user.id },
            data: { otpCode, otpExpiry }
        })

        const messageBody = `Your SmartPoultry password reset code is: ${otpCode}. It expires in 10 minutes.`
        try {
            if (user.phone) {
                await sendSMS(user.phone, messageBody)
            } else {
                await sendEmail(user.email, "Password Reset OTP", `<p>${messageBody}</p>`)
            }
        } catch (err) {
            console.error("Failed to send reset OTP:", err)
        }

        res.status(200).json({ 
            message: "If an account exists, an OTP has been sent.",
            mockOtp: process.env.NODE_ENV === 'development' ? otpCode : undefined 
        })
    } catch (error) {
        next(error)
    }
}

const resetPassword = async (req, res, next) => {
    try {
        const { email, otpCode, newPassword } = req.body

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) return res.status(404).json({ message: "Invalid request" })

        if (user.otpCode !== otpCode || !user.otpExpiry || user.otpExpiry < new Date()) {
            return res.status(401).json({ message: "Invalid or expired OTP" })
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10)

        await prisma.user.update({
            where: { id: user.id },
            data: { 
                password: hashedPassword,
                otpCode: null, 
                otpExpiry: null 
            }
        })

        res.status(200).json({ message: "Password updated successfully" })
    } catch (error) {
        next(error)
    }
}

module.exports = { login, register, googleAuth, verifyOTP, forgotPassword, resetPassword }
