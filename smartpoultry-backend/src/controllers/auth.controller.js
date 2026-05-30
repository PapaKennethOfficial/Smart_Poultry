const prisma = require("../config/prisma")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const admin = require("../config/firebaseAdmin")

const PUBLIC_REGISTRATION_ROLES = new Set(["CUSTOMER", "DELIVERY"])

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
        const { email, password } = req.body

        const user = await prisma.user.findUnique({
            where: { email }
        })

        // Use the same message for both cases to prevent user enumeration
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: "Invalid credentials" })
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
        const { name, email, password, role } = req.body
        const requestedRole = role || "CUSTOMER"

        if (!PUBLIC_REGISTRATION_ROLES.has(requestedRole)) {
            return res.status(403).json({
                message: "This role cannot be self-registered. Ask an administrator to create privileged accounts.",
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
                role: requestedRole,
            },
        })

        const { password: _pw, ...safeUser } = user

        res.status(201).json({
            message: "Account created successfully",
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
                    role: requestedRole
                }
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

module.exports = { login, register, googleAuth }
