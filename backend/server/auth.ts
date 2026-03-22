import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import type { UserRecord } from "./types.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-me";
const issuer = "unilink";

export interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
  };
}

export const hashPassword = async (password: string) => bcrypt.hash(password, 12);
export const comparePassword = async (password: string, hash: string) =>
  bcrypt.compare(password, hash);

export const signToken = (user: UserRecord, rememberMe = false) =>
  jwt.sign({ sub: user.id }, JWT_SECRET, {
    issuer,
    expiresIn: rememberMe ? "30d" : "12h",
  });

export const sanitizeUser = (user: UserRecord) => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  plan: user.plan,
  subscriptionStartedAt: user.subscriptionStartedAt,
  subscriptionExpiresAt: user.subscriptionExpiresAt,
});

export const requireAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, { issuer }) as jwt.JwtPayload;
    req.auth = { userId: String(payload.sub) };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};
