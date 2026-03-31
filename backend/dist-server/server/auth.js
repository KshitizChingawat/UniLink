import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters long.");
}
const ACCESS_TOKEN_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "30m");
const REMEMBER_ME_TOKEN_EXPIRES_IN = (process.env.JWT_REMEMBER_ME_EXPIRES_IN || "7d");
const issuer = "unilink";
export const hashPassword = async (password) => bcrypt.hash(password, 12);
export const comparePassword = async (password, hash) => bcrypt.compare(password, hash);
export const signToken = (user, rememberMe = false) => jwt.sign({ sub: user.id, role: user.role || "user" }, JWT_SECRET, {
    issuer,
    expiresIn: rememberMe ? REMEMBER_ME_TOKEN_EXPIRES_IN : ACCESS_TOKEN_EXPIRES_IN,
});
export const sanitizeUser = (user) => ({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role || "user",
    plan: user.plan,
    createdAt: user.createdAt,
    subscriptionStartedAt: user.subscriptionStartedAt,
    subscriptionExpiresAt: user.subscriptionExpiresAt,
    twoFactorEnabled: Boolean(user.preferences.twoFactorEnabled),
    twoFactorPhone: user.preferences.twoFactorPhone,
});
export const requireAuth = (req, res, next) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        const payload = jwt.verify(token, JWT_SECRET, { issuer });
        req.auth = { userId: String(payload.sub) };
        next();
    }
    catch {
        res.status(401).json({ error: "Unauthorized" });
    }
};
