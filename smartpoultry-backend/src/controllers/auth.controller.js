const prisma = require("../config/prisma")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")

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

        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" })

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
                // Schema default is WORKER; only honour role if explicitly supplied
                ...(role ? { role } : {}),
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

module.exports = { login, register }