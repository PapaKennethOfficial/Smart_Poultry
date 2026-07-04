const fs = require('fs');
let text = fs.readFileSync('src/controllers/auth.controller.js', 'utf8');
const exportIdx = text.indexOf('module.exports = {');
if (exportIdx !== -1) {
    text = text.substring(0, exportIdx);
}
text += `
const verifyOTP = async (req, res, next) => {
    try {
        const { userId, otpCode } = req.body;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ message: "User not found" });
        if (user.otpCode !== otpCode || !user.otpExpiry || user.otpExpiry < new Date()) {
            return res.status(401).json({ message: "Invalid or expired OTP" });
        }
        await prisma.user.update({
            where: { id: user.id },
            data: { otpCode: null, otpExpiry: null, lastLoginAt: new Date() }
        });
        const token = signToken(user);
        const { password: _pw, ...safeUser } = user;
        res.status(200).json({
            message: "Login successful",
            token,
            role: user.role,
            user: safeUser,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { login, register, googleAuth, verifyOTP };
`;
fs.writeFileSync('src/controllers/auth.controller.js', text);
