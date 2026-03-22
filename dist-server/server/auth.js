import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-me";
const issuer = "unilink";
export const hashPassword = async (password) => bcrypt.hash(password, 12);
export const comparePassword = async (password, hash) => bcrypt.compare(password, hash);
export const signToken = (user, rememberMe = false) => jwt.sign({ sub: user.id }, JWT_SECRET, {
    issuer,
    expiresIn: rememberMe ? "90d" : "7d",
});
export const sanitizeUser = (user) => ({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    plan: user.plan,
    subscriptionStartedAt: user.subscriptionStartedAt,
    subscriptionExpiresAt: user.subscriptionExpiresAt,
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
        res.status(401).json({ error: "Invalid or expired token" });
    }
};
