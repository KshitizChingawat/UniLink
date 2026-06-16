import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import type { UserRecord } from "./types.js";
import { appConfig } from "./config.js";
import { supabase } from "./supabase.js";

const ACCESS_TOKEN_EXPIRES_IN = appConfig.jwtExpiresIn as jwt.SignOptions["expiresIn"];
const REMEMBER_ME_TOKEN_EXPIRES_IN = appConfig.jwtRememberMeExpiresIn as jwt.SignOptions["expiresIn"];
const issuer = "unilink";
const authCookieName = "unilink_auth";
const csrfCookieName = "unilink_csrf";
const revokedTokenTable = "revoked_tokens";

type TokenKind = "access" | "upload" | "download";

export interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
    role: "user" | "admin";
    jti: string;
  };
}

export const hashPassword = async (password: string) => bcrypt.hash(password, 12);
export const comparePassword = async (password: string, hash: string) =>
  bcrypt.compare(password, hash);

const signJwt = (
  payload: Record<string, unknown>,
  expiresIn: jwt.SignOptions["expiresIn"],
) => {
  const jti = randomUUID();
  return {
    jti,
    token: jwt.sign({ ...payload, jti }, appConfig.jwtSecret, {
      issuer,
      algorithm: "HS256",
      expiresIn,
    }),
  };
};

export const signToken = (user: UserRecord, rememberMe = false) =>
  signJwt(
    { sub: user.id, role: user.role || "user", typ: "access" },
    rememberMe ? REMEMBER_ME_TOKEN_EXPIRES_IN : ACCESS_TOKEN_EXPIRES_IN,
  ).token;

export const signAuthToken = (user: UserRecord, rememberMe = false) =>
  signJwt(
    { sub: user.id, role: user.role || "user", typ: "access" },
    rememberMe ? REMEMBER_ME_TOKEN_EXPIRES_IN : ACCESS_TOKEN_EXPIRES_IN,
  );

export const signScopedToken = (
  payload: Record<string, unknown>,
  tokenKind: TokenKind,
  expiresIn: jwt.SignOptions["expiresIn"],
) =>
  signJwt({ ...payload, typ: tokenKind }, expiresIn);

const tokenRevocationCache = new Map<string, { value: boolean; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000;

export const revokeToken = async (jti: string, reason = "manual") => {
  tokenRevocationCache.set(jti, {
    value: true,
    expiresAt: Date.now() + CACHE_TTL_MS * 10,
  });

  const { error } = await supabase.from(revokedTokenTable).insert({
    jti,
    reason,
  });

  if (error && !error.message.toLowerCase().includes("duplicate")) {
    if (error.message.toLowerCase().includes("could not find the table")) {
      console.warn("Table 'revoked_tokens' not found in Supabase. Falling back to in-memory token revocation.");
    } else {
      throw new Error(`Failed to revoke token: ${error.message}`);
    }
  }
};

export const isTokenRevoked = async (jti: string) => {
  const cached = tokenRevocationCache.get(jti);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const { data, error } = await supabase
      .from(revokedTokenTable)
      .select("jti")
      .eq("jti", jti)
      .maybeSingle();

    if (error) {
      if (!error.message.toLowerCase().includes("could not find the table")) {
        console.error(`Error verifying token revocation for jti ${jti}:`, error.message);
      }
      return false;
    }

    const revoked = Boolean(data?.jti);
    tokenRevocationCache.set(jti, {
      value: revoked,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return revoked;
  } catch (err) {
    console.error(`Failed to verify token revocation for jti ${jti}:`, err);
    return false;
  }
};

export const verifyScopedToken = async (token: string, tokenKind: TokenKind) => {
  const payload = jwt.verify(token, appConfig.jwtSecret, { issuer, algorithms: ["HS256"] }) as jwt.JwtPayload;
  if (payload.typ !== tokenKind || typeof payload.jti !== "string") {
    throw new Error("Invalid token");
  }
  if (await isTokenRevoked(payload.jti)) {
    throw new Error("Token revoked");
  }
  return payload;
};

export const decodeToken = (token: string) =>
  jwt.verify(token, appConfig.jwtSecret, { issuer, algorithms: ["HS256"] }) as jwt.JwtPayload;

export const signLegacyToken = (user: UserRecord, rememberMe = false) =>
  jwt.sign({ sub: user.id, role: user.role || "user" }, appConfig.jwtSecret, {
    issuer,
    algorithm: "HS256",
    expiresIn: rememberMe ? REMEMBER_ME_TOKEN_EXPIRES_IN : ACCESS_TOKEN_EXPIRES_IN,
  });

export const sanitizeUser = (user: UserRecord) => ({
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

const parseCookieHeader = (cookieHeader?: string | null) => {
  if (!cookieHeader) return {} as Record<string, string>;
  return cookieHeader.split(";").reduce<Record<string, string>>((accumulator, cookiePart) => {
    const separatorIndex = cookiePart.indexOf("=");
    if (separatorIndex === -1) return accumulator;
    const key = cookiePart.slice(0, separatorIndex).trim();
    const value = cookiePart.slice(separatorIndex + 1).trim();
    if (key) {
      accumulator[key] = decodeURIComponent(value);
    }
    return accumulator;
  }, {});
};

export const createCsrfToken = () => randomBytes(24).toString("hex");

export const setAuthCookies = (res: Response, token: string, csrfToken: string, rememberMe = false) => {
  const maxAgeMs = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 30 * 60 * 1000;
  const secure = appConfig.isProduction;

  res.cookie(authCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: maxAgeMs,
    path: "/",
  });
  res.cookie(csrfCookieName, csrfToken, {
    httpOnly: false,
    sameSite: "lax",
    secure,
    maxAge: maxAgeMs,
    path: "/",
  });
};

export const clearAuthCookies = (res: Response) => {
  const secure = appConfig.isProduction;
  res.clearCookie(authCookieName, { httpOnly: true, sameSite: "lax", secure, path: "/" });
  res.clearCookie(csrfCookieName, { httpOnly: false, sameSite: "lax", secure, path: "/" });
};

export const requireCsrf = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    next();
    return;
  }

  const authorization = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
  if (authorization.startsWith("Bearer ") && authorization.slice(7).trim().length > 0) {
    next();
    return;
  }

  const cookies = parseCookieHeader(req.headers.cookie);
  const csrfCookie = cookies[csrfCookieName];
  const csrfHeader = typeof req.headers["x-csrf-token"] === "string" ? req.headers["x-csrf-token"] : null;

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    res.status(403).json({ error: "CSRF validation failed" });
    return;
  }

  next();
};

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const header = req.headers.authorization;
  const cookies = parseCookieHeader(req.headers.cookie);
  const token = header?.startsWith("Bearer ")
    ? header.slice(7)
    : cookies[authCookieName] || null;

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = await verifyScopedToken(token, "access");
    req.auth = {
      userId: String(payload.sub),
      role: payload.role === "admin" ? "admin" : "user",
      jti: String(payload.jti),
    };
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
};
