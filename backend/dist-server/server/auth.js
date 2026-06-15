import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { appConfig } from "./config.js";
import { supabase } from "./supabase.js";
const ACCESS_TOKEN_EXPIRES_IN = appConfig.jwtExpiresIn;
const REMEMBER_ME_TOKEN_EXPIRES_IN = appConfig.jwtRememberMeExpiresIn;
const issuer = "unilink";
const authCookieName = "unilink_auth";
const csrfCookieName = "unilink_csrf";
const revokedTokenTable = "revoked_tokens";
export const hashPassword = async (password) => bcrypt.hash(password, 12);
export const comparePassword = async (password, hash) => bcrypt.compare(password, hash);
const signJwt = (payload, expiresIn) => {
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
export const signToken = (user, rememberMe = false) => signJwt({ sub: user.id, role: user.role || "user", typ: "access" }, rememberMe ? REMEMBER_ME_TOKEN_EXPIRES_IN : ACCESS_TOKEN_EXPIRES_IN).token;
export const signAuthToken = (user, rememberMe = false) => signJwt({ sub: user.id, role: user.role || "user", typ: "access" }, rememberMe ? REMEMBER_ME_TOKEN_EXPIRES_IN : ACCESS_TOKEN_EXPIRES_IN);
export const signScopedToken = (payload, tokenKind, expiresIn) => signJwt({ ...payload, typ: tokenKind }, expiresIn);
export const revokeToken = async (jti, reason = "manual") => {
    const { error } = await supabase.from(revokedTokenTable).insert({
        jti,
        reason,
    });
    if (error && !error.message.toLowerCase().includes("duplicate")) {
        throw new Error(`Failed to revoke token: ${error.message}`);
    }
};
export const isTokenRevoked = async (jti) => {
    const { data, error } = await supabase
        .from(revokedTokenTable)
        .select("jti")
        .eq("jti", jti)
        .maybeSingle();
    if (error) {
        throw new Error(`Failed to verify token revocation: ${error.message}`);
    }
    return Boolean(data?.jti);
};
export const verifyScopedToken = async (token, tokenKind) => {
    const payload = jwt.verify(token, appConfig.jwtSecret, { issuer, algorithms: ["HS256"] });
    if (payload.typ !== tokenKind || typeof payload.jti !== "string") {
        throw new Error("Invalid token");
    }
    if (await isTokenRevoked(payload.jti)) {
        throw new Error("Token revoked");
    }
    return payload;
};
export const decodeToken = (token) => jwt.verify(token, appConfig.jwtSecret, { issuer, algorithms: ["HS256"] });
export const signLegacyToken = (user, rememberMe = false) => jwt.sign({ sub: user.id, role: user.role || "user" }, appConfig.jwtSecret, {
    issuer,
    algorithm: "HS256",
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
const parseCookieHeader = (cookieHeader) => {
    if (!cookieHeader)
        return {};
    return cookieHeader.split(";").reduce((accumulator, cookiePart) => {
        const separatorIndex = cookiePart.indexOf("=");
        if (separatorIndex === -1)
            return accumulator;
        const key = cookiePart.slice(0, separatorIndex).trim();
        const value = cookiePart.slice(separatorIndex + 1).trim();
        if (key) {
            accumulator[key] = decodeURIComponent(value);
        }
        return accumulator;
    }, {});
};
export const createCsrfToken = () => randomBytes(24).toString("hex");
export const setAuthCookies = (res, token, csrfToken, rememberMe = false) => {
    const maxAgeMs = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 30 * 60 * 1000;
    const secure = appConfig.isProduction;
    res.cookie(authCookieName, token, {
        httpOnly: true,
        sameSite: "strict",
        secure,
        maxAge: maxAgeMs,
        path: "/",
    });
    res.cookie(csrfCookieName, csrfToken, {
        httpOnly: false,
        sameSite: "strict",
        secure,
        maxAge: maxAgeMs,
        path: "/",
    });
};
export const clearAuthCookies = (res) => {
    const secure = appConfig.isProduction;
    res.clearCookie(authCookieName, { httpOnly: true, sameSite: "strict", secure, path: "/" });
    res.clearCookie(csrfCookieName, { httpOnly: false, sameSite: "strict", secure, path: "/" });
};
export const requireCsrf = (req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
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
export const requireAuth = async (req, res, next) => {
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
    }
    catch {
        res.status(401).json({ error: "Unauthorized" });
    }
};
