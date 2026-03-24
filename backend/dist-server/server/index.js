import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import os from "node:os";
import { Writable } from "node:stream";
import { z } from "zod";
import { supabase, FILE_BUCKET, SESSION_BUCKET } from "./supabase.js";
import { isEmailVerificationConfigured, isMailtrapDemoRestrictionError, sendRegistrationOtp } from "./mailer.js";
import { comparePassword, hashPassword, requireAuth, sanitizeUser, signToken } from "./auth.js";
import { decryptVaultContent, encryptVaultContent } from "./crypto.js";
import { nowIso, sanitizeFilename } from "./helpers.js";
import { createId, ensureDataDirs, loadDb, saveDb } from "./storage.js";
const app = express();
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-File-Name",
        "X-File-Size",
        "X-File-Type",
        "X-Sender-Device-Id",
        "X-Receiver-Device-Id",
        "X-Transfer-Method",
    ],
    exposedHeaders: ["Content-Disposition"],
    preflightContinue: false,
    optionsSuccessStatus: 204,
}));
const port = Number(process.env.PORT || 8787);
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 25, standardHeaders: true, legacyHeaders: false });
const FREE_FILE_SIZE_LIMIT = 100 * 1024 * 1024;
const PRO_FILE_SIZE_LIMIT = 10 * 1024 * 1024 * 1024;
const MONTH_IN_MS = 30 * 24 * 60 * 60 * 1000;
const OTP_FALLBACK_ENABLED = process.env.ALLOW_OTP_FALLBACK !== "false";
app.use(helmet({
    crossOriginResourcePolicy: false,
}));
// Skip body parsing for the binary file upload route — it reads req stream directly
app.use((req, res, next) => {
    if (req.path === "/api/file-transfers/upload")
        return next();
    express.json({ limit: "160mb" })(req, res, next);
});
app.use((req, res, next) => {
    if (req.path === "/api/file-transfers/upload")
        return next();
    express.urlencoded({ extended: true, limit: "160mb" })(req, res, next);
});
const registerSchema = z.object({
    email: z.string().trim().email().max(120),
    password: z.string().min(8).max(128),
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
});
const loginSchema = z.object({
    email: z.string().trim().email().max(120),
    password: z.string().min(1).max(128),
    rememberMe: z.boolean().optional(),
});
const googleAuthSchema = z.object({
    email: z.string().trim().email().max(120),
    rememberMe: z.boolean().optional(),
});
const forgotPasswordSchema = z.object({
    email: z.string().trim().email().max(120),
});
const registrationOtpRequestSchema = z.object({
    email: z.string().trim().email().max(120),
});
const registrationOtpVerifySchema = z.object({
    email: z.string().trim().email().max(120),
    otp: z.string().trim().length(6),
});
const pairClaimSchema = z.object({
    deviceName: z.string().trim().min(1).max(120),
    deviceType: z.enum(["desktop", "mobile", "tablet", "browser"]),
    platform: z.enum(["windows", "macos", "linux", "android", "ios", "browser"]),
    deviceId: z.string().trim().min(1).max(120),
});
const profileSchema = z.object({
    email: z.string().trim().email().max(120).optional(),
    firstName: z.string().trim().min(1).max(60).optional(),
    lastName: z.string().trim().min(1).max(60).optional(),
});
const billingSchema = z.object({
    plan: z.literal("pro"),
});
const deviceSchema = z.object({
    deviceName: z.string().trim().min(1).max(120),
    deviceType: z.enum(["desktop", "mobile", "tablet", "browser"]),
    platform: z.enum(["windows", "macos", "linux", "android", "ios", "browser"]),
    deviceId: z.string().trim().min(1).max(120),
    publicKey: z.string().trim().max(4096).optional(),
});
const fileTransferSchema = z.object({
    fileName: z.string().trim().min(1).max(180),
    fileSize: z.coerce.number().int().nonnegative().max(PRO_FILE_SIZE_LIMIT),
    fileType: z.string().trim().max(120).optional(),
    senderDeviceId: z.string().trim().min(1),
    receiverDeviceId: z.string().trim().optional(),
    transferMethod: z.enum(["cloud", "p2p", "local"]).default("cloud"),
});
const clipboardSchema = z.object({
    device_id: z.string().trim().min(1),
    content: z.string().min(1).max(10000),
    content_type: z.string().trim().max(80).default("text"),
});
const vaultSchema = z.object({
    item_type: z.enum(["clipboard", "file", "note"]),
    encrypted_content: z.string().min(1).max(50000),
    metadata: z.record(z.any()).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
});
const aiRequestSchema = z.object({
    content: z.string().min(1).max(20000),
    type: z.enum(["clipboard_analysis", "file_organization", "device_recommendation", "workflow_automation", "content_categorization"]),
    context: z.record(z.any()).optional(),
});
const bluetoothSchema = z.object({
    bluetooth_mac: z.string().trim().min(1).max(120),
    device_name: z.string().trim().min(1).max(120),
    device_capabilities: z.record(z.any()).default({}),
    signal_strength: z.number().int().min(-120).max(20).optional(),
    pairing_status: z.enum(["discovered", "pairing", "paired", "trusted", "blocked"]).default("discovered"),
});
const uploadHeadersSchema = z.object({
    "x-file-name": z.string().trim().min(1).max(180),
    "x-file-size": z.coerce.number().int().nonnegative().max(PRO_FILE_SIZE_LIMIT),
    "x-file-type": z.string().trim().max(120).optional(),
    "x-sender-device-id": z.string().trim().min(1),
    "x-receiver-device-id": z.string().trim().optional(),
    "x-transfer-method": z.enum(["cloud", "p2p", "local"]).optional(),
});
const isSubscriptionActive = (user) => user.role === "admin" ||
    (user.plan === "pro" &&
        Boolean(user.subscriptionExpiresAt) &&
        new Date(user.subscriptionExpiresAt).getTime() > Date.now());
const blockedEmailDomains = new Set([
    "example.com",
    "example.org",
    "example.net",
    "test.com",
    "invalid.com",
    "fake.com",
    "mailinator.com",
    "tempmail.com",
    "10minutemail.com",
    "yopmail.com",
    "guerrillamail.com",
    "sharklasers.com",
]);
const normalizeEmail = (email) => email.trim().toLowerCase();
const isLikelyRealEmail = (email) => {
    const normalized = normalizeEmail(email);
    const [, domain = ""] = normalized.split("@");
    return Boolean(domain) && !blockedEmailDomains.has(domain);
};
const assertValidEmailAddress = (email) => {
    if (!isLikelyRealEmail(email)) {
        return "Enter a valid email address";
    }
    return null;
};
const createOtp = () => `${Math.floor(100000 + Math.random() * 900000)}`;
const getLatestEmailVerification = (db, email) => db.emailVerifications
    .filter((entry) => entry.email === email && entry.purpose === "register")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null;
const isEmailVerificationValid = (verification) => Boolean(verification &&
    verification.verifiedAt &&
    new Date(verification.expiresAt).getTime() > Date.now());
const consumeExpiredEmailVerifications = (db) => {
    db.emailVerifications = db.emailVerifications.filter((entry) => new Date(entry.expiresAt).getTime() > Date.now());
};
const refreshUserPlan = (user) => {
    if (user.role === "admin") {
        if (user.plan !== "pro") {
            user.plan = "pro";
            user.updatedAt = nowIso();
            return true;
        }
        return false;
    }
    if (user.plan === "pro" && !isSubscriptionActive(user)) {
        user.plan = "free";
        user.subscriptionStartedAt = undefined;
        user.subscriptionExpiresAt = undefined;
        user.updatedAt = nowIso();
        return true;
    }
    return false;
};
const getUserFileLimit = (user) => isSubscriptionActive(user) ? PRO_FILE_SIZE_LIMIT : FREE_FILE_SIZE_LIMIT;
const formatLimitLabel = (bytes) => (bytes >= 1024 * 1024 * 1024 ? "10 GB" : "100 MB");
const getUploadLimitMessage = (user, limit) => isSubscriptionActive(user)
    ? `Your Pro plan supports files up to ${formatLimitLabel(limit)}.`
    : `This file can't be uploaded under the Free plan. Upgrade to Pro to share files up to 10 GB.`;
const parseUploadHeaders = (headers) => uploadHeadersSchema.safeParse({
    "x-file-name": typeof headers["x-file-name"] === "string"
        ? decodeURIComponent(headers["x-file-name"])
        : headers["x-file-name"],
    "x-file-size": headers["x-file-size"],
    "x-file-type": headers["x-file-type"],
    "x-sender-device-id": headers["x-sender-device-id"],
    "x-receiver-device-id": headers["x-receiver-device-id"],
    "x-transfer-method": headers["x-transfer-method"],
});
const userResponse = (user) => {
    refreshUserPlan(user);
    return sanitizeUser(user);
};
const getAdminCredentials = () => {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
        return null;
    }
    return { email, password };
};
const ensureAdminUser = async (db, email, password) => {
    const timestamp = nowIso();
    const subscriptionExpiresAt = new Date(Date.now() + MONTH_IN_MS).toISOString();
    let user = db.users.find((entry) => normalizeEmail(entry.email) === email) || null;
    if (!user) {
        user = {
            id: createId(),
            email,
            firstName: "UniLink",
            lastName: "Admin",
            passwordHash: await hashPassword(password),
            role: "admin",
            createdAt: timestamp,
            updatedAt: timestamp,
            plan: "pro",
            subscriptionStartedAt: timestamp,
            subscriptionExpiresAt,
            preferences: {
                aiAssistantEnabled: true,
            },
        };
        db.users.push(user);
        return { user, changed: true };
    }
    let changed = false;
    if (!(await comparePassword(password, user.passwordHash))) {
        user.passwordHash = await hashPassword(password);
        changed = true;
    }
    if (user.role !== "admin") {
        user.role = "admin";
        changed = true;
    }
    if (user.plan !== "pro") {
        user.plan = "pro";
        changed = true;
    }
    if (user.firstName !== "UniLink") {
        user.firstName = "UniLink";
        changed = true;
    }
    if (user.lastName !== "Admin") {
        user.lastName = "Admin";
        changed = true;
    }
    user.subscriptionStartedAt = timestamp;
    user.subscriptionExpiresAt = subscriptionExpiresAt;
    user.updatedAt = timestamp;
    changed = true;
    return { user, changed };
};
const findUser = async (userId) => {
    const db = await loadDb();
    const user = db.users.find((entry) => entry.id === userId) || null;
    if (user && refreshUserPlan(user)) {
        await saveDb(db);
    }
    return user;
};
const getLanAddress = () => {
    const interfaces = os.networkInterfaces();
    for (const network of Object.values(interfaces)) {
        for (const entry of network || []) {
            if (entry.family === "IPv4" && !entry.internal) {
                return entry.address;
            }
        }
    }
    return "localhost";
};
const getAppBaseUrl = (req) => {
    const configured = process.env.APP_BASE_URL?.trim();
    if (configured) {
        return configured.replace(/\/$/, "");
    }
    const originHeader = req.headers.origin;
    const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
    if (origin) {
        const normalizedOrigin = origin.replace(/\/$/, "");
        if (!normalizedOrigin.includes("localhost") && !normalizedOrigin.includes("127.0.0.1")) {
            return normalizedOrigin;
        }
        const frontendPort = normalizedOrigin.split(":")[2] || "5173";
        return `http://${getLanAddress()}:${frontendPort}`;
    }
    const forwardedHost = req.headers["x-forwarded-host"];
    const hostHeader = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost || req.headers.host || "";
    const protocolHeader = req.headers["x-forwarded-proto"];
    const protocol = Array.isArray(protocolHeader) ? protocolHeader[0] : protocolHeader || req.protocol || "http";
    if (hostHeader && !String(hostHeader).includes("localhost") && !String(hostHeader).startsWith("127.0.0.1")) {
        return `${protocol}://${hostHeader}`;
    }
    const lanAddress = getLanAddress();
    const portFromHost = String(hostHeader).split(":")[1] || "5173";
    return `http://${lanAddress}:${portFromHost}`;
};
const buildPairSession = (userId) => {
    const createdAt = nowIso();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const code = createId().replace(/-/g, "");
    return {
        id: createId(),
        userId,
        code,
        createdAt,
        expiresAt,
    };
};
const isPairSessionExpired = (session) => Boolean(session.usedAt) || new Date(session.expiresAt).getTime() <= Date.now();
app.get("/api/health", async (_req, res) => {
    const db = await loadDb();
    res.json({
        ok: true,
        users: db.users.length,
        timestamp: nowIso(),
    });
});
app.post("/api/auth/request-registration-otp", authLimiter, async (req, res) => {
    const parsed = registrationOtpRequestSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Enter a valid email address" });
        return;
    }
    const email = normalizeEmail(parsed.data.email);
    const emailError = assertValidEmailAddress(email);
    if (emailError) {
        res.status(400).json({ error: emailError });
        return;
    }
    if (!isEmailVerificationConfigured()) {
        res.status(503).json({
            error: "Email verification is not configured yet. Add SMTP settings on the server first.",
        });
        return;
    }
    try {
        const db = await loadDb();
        consumeExpiredEmailVerifications(db);
        if (db.users.some((user) => normalizeEmail(user.email) === email)) {
            res.status(409).json({ error: "Email is already registered" });
            return;
        }
        const otp = createOtp();
        const timestamp = nowIso();
        const verification = {
            id: createId(),
            email,
            purpose: "register",
            otpHash: await hashPassword(otp),
            createdAt: timestamp,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        };
        db.emailVerifications = db.emailVerifications.filter((entry) => !(entry.email === email && entry.purpose === "register"));
        db.emailVerifications.unshift(verification);
        await saveDb(db);
        try {
            await sendRegistrationOtp(email, otp);
            res.json({
                success: true,
                message: "Verification code sent to your email.",
            });
            return;
        }
        catch (mailError) {
            if (OTP_FALLBACK_ENABLED && isMailtrapDemoRestrictionError(mailError)) {
                res.json({
                    success: true,
                    message: "Email delivery is in testing mode. Use the temporary OTP shown below.",
                    developmentOtp: otp,
                    deliveryMode: "fallback",
                });
                return;
            }
            throw mailError;
        }
    }
    catch (error) {
        console.error("Registration OTP error:", error);
        const message = error instanceof Error && error.message
            ? error.message
            : "Failed to send the verification code. Please try again.";
        res.status(500).json({ error: message });
    }
});
app.post("/api/auth/verify-registration-otp", authLimiter, async (req, res) => {
    const parsed = registrationOtpVerifySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Enter the 6-digit verification code." });
        return;
    }
    const email = normalizeEmail(parsed.data.email);
    const emailError = assertValidEmailAddress(email);
    if (emailError) {
        res.status(400).json({ error: emailError });
        return;
    }
    try {
        const db = await loadDb();
        consumeExpiredEmailVerifications(db);
        const verification = getLatestEmailVerification(db, email);
        if (!verification || new Date(verification.expiresAt).getTime() <= Date.now()) {
            res.status(400).json({ error: "Verification code expired. Request a new code." });
            return;
        }
        const otpMatches = await comparePassword(parsed.data.otp, verification.otpHash);
        if (!otpMatches) {
            res.status(400).json({ error: "Invalid verification code." });
            return;
        }
        verification.verifiedAt = nowIso();
        await saveDb(db);
        res.json({
            success: true,
            message: "Email verified successfully.",
        });
    }
    catch (error) {
        console.error("Registration OTP verification error:", error);
        res.status(500).json({ error: "Failed to verify the code. Please try again." });
    }
});
app.post("/api/auth/register", authLimiter, async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Enter a valid email address" });
        return;
    }
    const email = normalizeEmail(parsed.data.email);
    const emailError = assertValidEmailAddress(email);
    if (emailError) {
        res.status(400).json({ error: emailError });
        return;
    }
    try {
        const db = await loadDb();
        consumeExpiredEmailVerifications(db);
        if (db.users.some((user) => user.email === email)) {
            res.json({ error: "Email is already registered", duplicateEmail: true });
            return;
        }
        const verification = getLatestEmailVerification(db, email);
        if (!isEmailVerificationValid(verification)) {
            res.status(400).json({ error: "Verify your email with the OTP before creating the account." });
            return;
        }
        const timestamp = nowIso();
        const user = {
            id: createId(),
            email,
            firstName: parsed.data.firstName.trim(),
            lastName: parsed.data.lastName.trim(),
            passwordHash: await hashPassword(parsed.data.password),
            createdAt: timestamp,
            updatedAt: timestamp,
            plan: "free",
            preferences: {
                aiAssistantEnabled: true,
            },
        };
        db.users.push(user);
        db.emailVerifications = db.emailVerifications.filter((entry) => !(entry.email === email && entry.purpose === "register"));
        await saveDb(db);
        res.status(201).json({
            token: signToken(user),
            user: userResponse(user),
        });
    }
    catch (error) {
        console.error("Registration persistence error:", error);
        res.status(500).json({ error: "Failed to create your account. Please try again." });
    }
});
app.post("/api/auth/login", authLimiter, async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Enter a valid email address" });
        return;
    }
    const email = normalizeEmail(parsed.data.email);
    const emailError = assertValidEmailAddress(email);
    if (emailError) {
        res.status(400).json({ error: emailError });
        return;
    }
    try {
        const db = await loadDb();
        const adminCredentials = getAdminCredentials();
        if (adminCredentials &&
            email === adminCredentials.email &&
            parsed.data.password === adminCredentials.password) {
            const { user, changed } = await ensureAdminUser(db, adminCredentials.email, adminCredentials.password);
            if (changed) {
                await saveDb(db);
            }
            res.json({
                token: signToken(user, parsed.data.rememberMe),
                user: userResponse(user),
            });
            return;
        }
        const user = db.users.find((entry) => normalizeEmail(entry.email) === email);
        if (!user || !(await comparePassword(parsed.data.password, user.passwordHash))) {
            res.status(401).json({ error: "Invalid credentials" });
            return;
        }
        if (refreshUserPlan(user)) {
            await saveDb(db);
        }
        res.json({
            token: signToken(user, parsed.data.rememberMe),
            user: userResponse(user),
        });
    }
    catch (error) {
        console.error("Login lookup error:", error);
        res.status(500).json({ error: "Unable to sign in right now. Please try again." });
    }
});
app.post("/api/auth/google", authLimiter, async (req, res) => {
    const parsed = googleAuthSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Enter a valid email address" });
        return;
    }
    const email = normalizeEmail(parsed.data.email);
    if (!email.endsWith("@gmail.com") && !email.endsWith("@googlemail.com")) {
        res.status(400).json({ error: "Use a valid Google Gmail address" });
        return;
    }
    try {
        const db = await loadDb();
        let user = db.users.find((entry) => normalizeEmail(entry.email) === email);
        if (!user) {
            const localPart = email.split("@")[0];
            const [firstName = "Google", lastName = "User"] = localPart
                .split(/[.\-_]/)
                .filter(Boolean)
                .map((part) => part.charAt(0).toUpperCase() + part.slice(1));
            user = {
                id: createId(),
                email,
                firstName,
                lastName,
                passwordHash: await hashPassword(createId()),
                createdAt: nowIso(),
                updatedAt: nowIso(),
                plan: "free",
                preferences: {
                    aiAssistantEnabled: true,
                },
            };
            db.users.push(user);
            await saveDb(db);
        }
        if (refreshUserPlan(user)) {
            await saveDb(db);
        }
        res.json({
            token: signToken(user, parsed.data.rememberMe),
            user: userResponse(user),
        });
    }
    catch (error) {
        console.error("Google auth persistence error:", error);
        res.status(500).json({ error: "Unable to sign in with Google right now." });
    }
});
app.post("/api/auth/forgot-password", authLimiter, async (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Enter a valid email address" });
        return;
    }
    const email = normalizeEmail(parsed.data.email);
    const emailError = assertValidEmailAddress(email);
    if (emailError) {
        res.status(400).json({ error: emailError });
        return;
    }
    try {
        const db = await loadDb();
        const user = db.users.find((entry) => normalizeEmail(entry.email) === email);
        res.json({
            success: true,
            message: user
                ? "Password reset support has been initiated for this account."
                : "If an account exists for this email, password reset support has been initiated.",
        });
    }
    catch (error) {
        console.error("Forgot password lookup error:", error);
        res.status(500).json({ error: "Unable to start password reset support right now." });
    }
});
app.get("/api/auth/me", requireAuth, async (req, res) => {
    const user = await findUser(req.auth.userId);
    if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
    }
    res.json({ user: userResponse(user) });
});
app.post("/api/billing/subscribe", requireAuth, async (req, res) => {
    const parsed = billingSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid subscription request" });
        return;
    }
    const db = await loadDb();
    const user = db.users.find((entry) => entry.id === req.auth.userId);
    if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
    }
    const paymentDate = nowIso();
    user.plan = "pro";
    user.subscriptionStartedAt = paymentDate;
    user.subscriptionExpiresAt = new Date(Date.now() + MONTH_IN_MS).toISOString();
    user.updatedAt = paymentDate;
    await saveDb(db);
    res.json({
        user: userResponse(user),
        message: "Pro subscription activated for 30 days.",
    });
});
app.post("/api/pair-sessions", requireAuth, async (req, res) => {
    const db = await loadDb();
    db.pairSessions = db.pairSessions.filter((session) => !isPairSessionExpired(session));
    const appBaseUrl = getAppBaseUrl(req);
    const existing = db.pairSessions.find((session) => session.userId === req.auth.userId && !isPairSessionExpired(session));
    if (existing) {
        await saveDb(db);
        res.status(201).json({
            ...existing,
            connectUrl: `${appBaseUrl}/connect/${existing.code}`,
        });
        return;
    }
    const session = buildPairSession(req.auth.userId);
    db.pairSessions.unshift(session);
    await saveDb(db);
    res.status(201).json({
        ...session,
        connectUrl: `${appBaseUrl}/connect/${session.code}`,
    });
});
app.get("/api/pair-sessions/:code", async (req, res) => {
    const db = await loadDb();
    const session = db.pairSessions.find((entry) => entry.code === req.params.code);
    if (!session || isPairSessionExpired(session)) {
        res.status(404).json({ error: "Pairing session not found or expired" });
        return;
    }
    const user = db.users.find((entry) => entry.id === session.userId);
    res.json({
        code: session.code,
        expiresAt: session.expiresAt,
        accountLabel: user ? `${user.firstName} ${user.lastName}`.trim() || user.email : "UniLink account",
    });
});
app.post("/api/pair-sessions/:code/claim", async (req, res) => {
    const parsed = pairClaimSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid device claim payload" });
        return;
    }
    const db = await loadDb();
    const session = db.pairSessions.find((entry) => entry.code === req.params.code);
    if (!session || isPairSessionExpired(session)) {
        res.status(404).json({ error: "Pairing session not found or expired" });
        return;
    }
    const user = db.users.find((entry) => entry.id === session.userId);
    if (!user) {
        res.status(404).json({ error: "Account not found" });
        return;
    }
    const timestamp = nowIso();
    let device = db.devices.find((entry) => entry.userId === user.id && entry.deviceId === parsed.data.deviceId);
    if (device) {
        device.deviceName = parsed.data.deviceName;
        device.deviceType = parsed.data.deviceType;
        device.platform = parsed.data.platform;
        device.lastSeen = timestamp;
        device.isActive = true;
        device.updatedAt = timestamp;
    }
    else {
        device = {
            id: createId(),
            userId: user.id,
            deviceName: parsed.data.deviceName,
            deviceType: parsed.data.deviceType,
            platform: parsed.data.platform,
            deviceId: parsed.data.deviceId,
            lastSeen: timestamp,
            isActive: true,
            createdAt: timestamp,
            updatedAt: timestamp,
        };
        db.devices.push(device);
    }
    session.usedAt = timestamp;
    session.claimedDeviceId = device.id;
    await saveDb(db);
    res.json({
        token: signToken(user, true),
        user: userResponse(user),
        device,
    });
});
app.patch("/api/auth/profile", requireAuth, async (req, res) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid profile update" });
        return;
    }
    const db = await loadDb();
    const user = db.users.find((entry) => entry.id === req.auth.userId);
    if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
    }
    if (parsed.data.email) {
        const normalizedEmail = normalizeEmail(parsed.data.email);
        const emailError = assertValidEmailAddress(normalizedEmail);
        if (emailError) {
            res.status(400).json({ error: emailError });
            return;
        }
        const duplicateUser = db.users.find((entry) => entry.id !== user.id && entry.email === normalizedEmail);
        if (duplicateUser) {
            res.status(409).json({ error: "Email is already registered" });
            return;
        }
        user.email = normalizedEmail;
    }
    if (parsed.data.firstName) {
        user.firstName = parsed.data.firstName;
    }
    if (parsed.data.lastName) {
        user.lastName = parsed.data.lastName;
    }
    user.updatedAt = nowIso();
    await saveDb(db);
    res.json({ user: userResponse(user) });
});
app.get("/api/devices", requireAuth, async (req, res) => {
    const db = await loadDb();
    const devices = db.devices
        .filter((device) => device.userId === req.auth.userId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    res.json(devices);
});
app.post("/api/devices", requireAuth, async (req, res) => {
    const parsed = deviceSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid device payload" });
        return;
    }
    const db = await loadDb();
    const timestamp = nowIso();
    const existing = db.devices.find((device) => device.userId === req.auth.userId && device.deviceId === parsed.data.deviceId);
    if (existing) {
        existing.deviceName = parsed.data.deviceName;
        existing.deviceType = parsed.data.deviceType;
        existing.platform = parsed.data.platform;
        existing.publicKey = parsed.data.publicKey;
        existing.lastSeen = timestamp;
        existing.isActive = true;
        existing.updatedAt = timestamp;
        await saveDb(db);
        res.json(existing);
        return;
    }
    const device = {
        id: createId(),
        userId: req.auth.userId,
        deviceName: parsed.data.deviceName,
        deviceType: parsed.data.deviceType,
        platform: parsed.data.platform,
        deviceId: parsed.data.deviceId,
        publicKey: parsed.data.publicKey,
        lastSeen: timestamp,
        isActive: true,
        createdAt: timestamp,
        updatedAt: timestamp,
    };
    db.devices.push(device);
    await saveDb(db);
    res.status(201).json(device);
});
app.patch("/api/devices/:id", requireAuth, async (req, res) => {
    const db = await loadDb();
    const device = db.devices.find((entry) => entry.id === req.params.id && entry.userId === req.auth.userId);
    if (!device) {
        res.status(404).json({ error: "Device not found" });
        return;
    }
    if (typeof req.body.isActive === "boolean") {
        device.isActive = req.body.isActive;
    }
    device.lastSeen = nowIso();
    device.updatedAt = nowIso();
    await saveDb(db);
    res.json(device);
});
app.delete("/api/devices/:id", requireAuth, async (req, res) => {
    const db = await loadDb();
    db.devices = db.devices.filter((entry) => !(entry.id === req.params.id && entry.userId === req.auth.userId));
    await saveDb(db);
    res.status(204).send();
});
app.get("/api/clipboard", requireAuth, async (req, res) => {
    const db = await loadDb();
    res.json(db.clipboard
        .filter((item) => item.userId === req.auth.userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});
app.post("/api/clipboard", requireAuth, async (req, res) => {
    const parsed = clipboardSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid clipboard payload" });
        return;
    }
    const db = await loadDb();
    const devices = db.devices.filter((device) => device.userId === req.auth.userId);
    const item = {
        id: createId(),
        userId: req.auth.userId,
        deviceId: parsed.data.device_id,
        content: parsed.data.content,
        contentType: parsed.data.content_type,
        syncTimestamp: nowIso(),
        syncedToDevices: devices.map((device) => device.id).filter((id) => id !== parsed.data.device_id),
        createdAt: nowIso(),
    };
    db.clipboard.unshift(item);
    db.clipboard = db.clipboard.slice(0, 100);
    await saveDb(db);
    res.status(201).json(item);
});
app.delete("/api/clipboard/:id", requireAuth, async (req, res) => {
    const db = await loadDb();
    db.clipboard = db.clipboard.filter((entry) => !(entry.id === req.params.id && entry.userId === req.auth.userId));
    await saveDb(db);
    res.status(204).send();
});
app.get("/api/file-transfers", requireAuth, async (req, res) => {
    const db = await loadDb();
    res.json(db.fileTransfers
        .filter((transfer) => transfer.userId === req.auth.userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});
app.post("/api/file-transfers/upload", requireAuth, async (req, res) => {
    const parsedHeaders = parseUploadHeaders(req.headers);
    if (!parsedHeaders.success) {
        res.status(400).json({ error: "Invalid upload metadata" });
        return;
    }
    const db = await loadDb();
    const user = db.users.find((entry) => entry.id === req.auth.userId);
    if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
    }
    if (refreshUserPlan(user)) {
        await saveDb(db);
    }
    const fileLimit = getUserFileLimit(user);
    if (parsedHeaders.data["x-file-size"] > fileLimit) {
        res.status(400).json({
            error: getUploadLimitMessage(user, fileLimit),
            fileLimit,
            plan: isSubscriptionActive(user) ? "pro" : "free",
        });
        return;
    }
    const transferId = createId();
    const storagePath = `${req.auth.userId}/${transferId}-${sanitizeFilename(parsedHeaders.data["x-file-name"])}`;
    // Buffer the request body into memory, enforcing the size limit.
    // Using Writable (not Transform) avoids backpressure from an unconsumed readable side.
    let bytesWritten = 0;
    const chunks = [];
    try {
        await new Promise((resolve, reject) => {
            const sink = new Writable({
                write(chunk, _enc, cb) {
                    bytesWritten += chunk.length;
                    if (bytesWritten > fileLimit) {
                        cb(new Error(`File exceeds the ${formatLimitLabel(fileLimit)} plan limit.`));
                    }
                    else {
                        chunks.push(chunk);
                        cb();
                    }
                },
            });
            req.pipe(sink);
            sink.on("finish", resolve);
            sink.on("error", reject);
            req.on("error", reject);
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        res.status(400).json({ error: message });
        return;
    }
    if (bytesWritten !== parsedHeaders.data["x-file-size"]) {
        res.status(400).json({ error: "Uploaded file size did not match the declared size." });
        return;
    }
    const fileBuffer = Buffer.concat(chunks);
    const { error: uploadError } = await supabase.storage
        .from(FILE_BUCKET)
        .upload(storagePath, fileBuffer, {
        contentType: parsedHeaders.data["x-file-type"] || "application/octet-stream",
        upsert: false,
    });
    if (uploadError) {
        console.error("Supabase Storage upload error:", uploadError);
        res.status(500).json({ error: "Failed to store file. Please try again." });
        return;
    }
    const transfer = {
        id: transferId,
        userId: req.auth.userId,
        senderDeviceId: parsedHeaders.data["x-sender-device-id"],
        receiverDeviceId: parsedHeaders.data["x-receiver-device-id"],
        fileName: parsedHeaders.data["x-file-name"],
        fileSize: parsedHeaders.data["x-file-size"],
        fileType: parsedHeaders.data["x-file-type"],
        transferStatus: "completed",
        transferMethod: parsedHeaders.data["x-transfer-method"] || "cloud",
        createdAt: nowIso(),
        completedAt: nowIso(),
        filePath: storagePath, // Supabase Storage path
    };
    db.fileTransfers.unshift(transfer);
    await saveDb(db);
    res.status(201).json(transfer);
});
app.post("/api/file-transfers", requireAuth, async (req, res) => {
    const parsed = fileTransferSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid file transfer payload" });
        return;
    }
    const db = await loadDb();
    const user = db.users.find((entry) => entry.id === req.auth.userId);
    if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
    }
    if (refreshUserPlan(user)) {
        await saveDb(db);
    }
    const fileLimit = getUserFileLimit(user);
    if (parsed.data.fileSize > fileLimit) {
        res.status(400).json({
            error: getUploadLimitMessage(user, fileLimit),
            fileLimit,
            plan: isSubscriptionActive(user) ? "pro" : "free",
        });
        return;
    }
    const base64Data = typeof req.body.fileData === "string" ? req.body.fileData : "";
    if (base64Data) {
        const transferId = createId();
        const storagePath = `${req.auth.userId}/${transferId}-${sanitizeFilename(parsed.data.fileName)}`;
        const buffer = Buffer.from(base64Data, "base64");
        const { error: uploadError } = await supabase.storage
            .from(FILE_BUCKET)
            .upload(storagePath, buffer, {
            contentType: parsed.data.fileType || "application/octet-stream",
            upsert: false,
        });
        if (uploadError) {
            console.error("Supabase Storage upload error (base64 path):", uploadError);
            res.status(500).json({ error: "Failed to store file. Please try again." });
            return;
        }
        const transfer = {
            id: transferId,
            userId: req.auth.userId,
            senderDeviceId: parsed.data.senderDeviceId,
            receiverDeviceId: parsed.data.receiverDeviceId,
            fileName: parsed.data.fileName,
            fileSize: parsed.data.fileSize,
            fileType: parsed.data.fileType,
            transferStatus: "completed",
            transferMethod: parsed.data.transferMethod,
            createdAt: nowIso(),
            completedAt: nowIso(),
            filePath: storagePath,
        };
        db.fileTransfers.unshift(transfer);
        await saveDb(db);
        res.status(201).json(transfer);
        return;
    }
    const transfer = {
        id: createId(),
        userId: req.auth.userId,
        senderDeviceId: parsed.data.senderDeviceId,
        receiverDeviceId: parsed.data.receiverDeviceId,
        fileName: parsed.data.fileName,
        fileSize: parsed.data.fileSize,
        fileType: parsed.data.fileType,
        transferStatus: "pending",
        transferMethod: parsed.data.transferMethod,
        createdAt: nowIso(),
    };
    db.fileTransfers.unshift(transfer);
    await saveDb(db);
    res.status(201).json(transfer);
});
app.patch("/api/file-transfers/:id", requireAuth, async (req, res) => {
    const db = await loadDb();
    const transfer = db.fileTransfers.find((entry) => entry.id === req.params.id && entry.userId === req.auth.userId);
    if (!transfer) {
        res.status(404).json({ error: "Transfer not found" });
        return;
    }
    if (typeof req.body.transfer_status === "string") {
        transfer.transferStatus = req.body.transfer_status;
        if (req.body.transfer_status === "completed") {
            transfer.completedAt = nowIso();
        }
    }
    await saveDb(db);
    res.json(transfer);
});
app.get("/api/file-transfers/:id/download", requireAuth, async (req, res) => {
    const db = await loadDb();
    const transfer = db.fileTransfers.find((entry) => entry.id === req.params.id && entry.userId === req.auth.userId);
    if (!transfer?.filePath) {
        res.status(404).json({ error: "File not found" });
        return;
    }
    // Generate a short-lived signed URL from Supabase Storage
    const { data, error } = await supabase.storage
        .from(FILE_BUCKET)
        .createSignedUrl(transfer.filePath, 60, {
        download: transfer.fileName,
    });
    if (error || !data?.signedUrl) {
        console.error("Supabase signed URL error:", error);
        res.status(500).json({ error: "Could not generate download link" });
        return;
    }
    res.redirect(data.signedUrl);
});
app.get("/api/vault", requireAuth, async (req, res) => {
    const db = await loadDb();
    res.json(db.vault
        .filter((item) => item.userId === req.auth.userId)
        .map((item) => ({
        ...item,
        encrypted_content: item.encryptedContent,
        item_type: item.itemType,
        created_at: item.createdAt,
        accessed_at: item.accessedAt,
    })));
});
app.post("/api/vault", requireAuth, async (req, res) => {
    const parsed = vaultSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid vault payload" });
        return;
    }
    const item = {
        id: createId(),
        userId: req.auth.userId,
        itemType: parsed.data.item_type,
        encryptedContent: encryptVaultContent(parsed.data.encrypted_content),
        metadata: parsed.data.metadata,
        tags: parsed.data.tags || [],
        createdAt: nowIso(),
        accessedAt: nowIso(),
    };
    const db = await loadDb();
    db.vault.unshift(item);
    await saveDb(db);
    res.status(201).json(item);
});
app.delete("/api/vault/:id", requireAuth, async (req, res) => {
    const db = await loadDb();
    db.vault = db.vault.filter((entry) => !(entry.id === req.params.id && entry.userId === req.auth.userId));
    await saveDb(db);
    res.status(204).send();
});
app.get("/api/vault/:id", requireAuth, async (req, res) => {
    const db = await loadDb();
    const item = db.vault.find((entry) => entry.id === req.params.id && entry.userId === req.auth.userId);
    if (!item) {
        res.status(404).json({ error: "Vault item not found" });
        return;
    }
    item.accessedAt = nowIso();
    await saveDb(db);
    res.json({
        ...item,
        decrypted_content: decryptVaultContent(item.encryptedContent),
    });
});
const buildSuggestion = (payload) => {
    const base = {
        id: createId(),
        createdAt: nowIso(),
        expiresAt: null,
        used: false,
    };
    if (payload.type === "clipboard_analysis") {
        const content = payload.content;
        const kind = content.startsWith("http") ? "url" : content.includes("@") ? "contact" : "text";
        return {
            ...base,
            userId: "",
            suggestionType: payload.type,
            confidenceScore: 0.83,
            content: {
                kind,
                summary: kind === "url" ? "Save this link for later or send it to another device." : "Pin this item or store it in the secure vault.",
            },
        };
    }
    if (payload.type === "file_organization") {
        const extension = String(payload.context?.extension || "").toLowerCase();
        return {
            ...base,
            userId: "",
            suggestionType: payload.type,
            confidenceScore: 0.78,
            content: {
                folder: ["png", "jpg", "jpeg", "webp"].includes(extension) ? "Images" : "Documents",
                tags: [extension || "file", "shared"],
            },
        };
    }
    return {
        ...base,
        userId: "",
        suggestionType: payload.type,
        confidenceScore: 0.72,
        content: {
            summary: "UniLink recommends prioritizing active devices and archiving stale items.",
        },
    };
};
app.get("/api/ai-suggestions", requireAuth, async (req, res) => {
    const db = await loadDb();
    res.json(db.aiSuggestions
        .filter((item) => item.userId === req.auth.userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});
app.post("/api/ai-assistant", requireAuth, async (req, res) => {
    const parsed = aiRequestSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid AI assistant request" });
        return;
    }
    const suggestion = buildSuggestion(parsed.data);
    suggestion.userId = req.auth.userId;
    const db = await loadDb();
    db.aiSuggestions.unshift(suggestion);
    await saveDb(db);
    res.status(201).json(suggestion);
});
app.patch("/api/ai-suggestions/:id", requireAuth, async (req, res) => {
    const db = await loadDb();
    const suggestion = db.aiSuggestions.find((entry) => entry.id === req.params.id && entry.userId === req.auth.userId);
    if (!suggestion) {
        res.status(404).json({ error: "Suggestion not found" });
        return;
    }
    if (typeof req.body.used === "boolean") {
        suggestion.used = req.body.used;
    }
    if (typeof req.body.feedback_score === "number") {
        suggestion.feedbackScore = req.body.feedback_score;
    }
    if (typeof req.body.used_at === "string") {
        suggestion.usedAt = req.body.used_at;
    }
    await saveDb(db);
    res.json(suggestion);
});
app.post("/api/ai-suggestions/:id/feedback", requireAuth, async (req, res) => {
    const db = await loadDb();
    const suggestion = db.aiSuggestions.find((entry) => entry.id === req.params.id && entry.userId === req.auth.userId);
    if (!suggestion) {
        res.status(404).json({ error: "Suggestion not found" });
        return;
    }
    suggestion.feedbackScore = Number(req.body.feedback_score ?? 0);
    await saveDb(db);
    res.json(suggestion);
});
app.delete("/api/ai-suggestions/:id", requireAuth, async (req, res) => {
    const db = await loadDb();
    db.aiSuggestions = db.aiSuggestions.filter((entry) => !(entry.id === req.params.id && entry.userId === req.auth.userId));
    await saveDb(db);
    res.status(204).send();
});
app.patch("/api/user/preferences", requireAuth, async (req, res) => {
    const db = await loadDb();
    const user = db.users.find((entry) => entry.id === req.auth.userId);
    if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
    }
    if (typeof req.body.ai_assistant_enabled === "boolean") {
        user.preferences.aiAssistantEnabled = req.body.ai_assistant_enabled;
    }
    user.updatedAt = nowIso();
    await saveDb(db);
    res.json({ preferences: user.preferences });
});
app.post("/api/sync/trigger", requireAuth, async (req, res) => {
    const db = await loadDb();
    const deviceCount = db.devices.filter((device) => device.userId === req.auth.userId).length;
    const clipboardCount = db.clipboard.filter((item) => item.userId === req.auth.userId).length;
    res.json({
        message: "Sync completed",
        devices: deviceCount,
        clipboardItems: clipboardCount,
        timestamp: nowIso(),
    });
});
app.get("/api/bluetooth-devices", requireAuth, async (req, res) => {
    const db = await loadDb();
    const devices = db.bluetoothDevices
        .filter((item) => item.userId === req.auth.userId)
        .sort((a, b) => b.lastDiscovered.localeCompare(a.lastDiscovered));
    res.json(devices);
});
app.post("/api/bluetooth-devices", requireAuth, async (req, res) => {
    const parsed = bluetoothSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid bluetooth payload" });
        return;
    }
    const db = await loadDb();
    const existing = db.bluetoothDevices.find((item) => item.userId === req.auth.userId && item.bluetoothMac === parsed.data.bluetooth_mac);
    if (existing) {
        existing.deviceName = parsed.data.device_name;
        existing.deviceCapabilities = parsed.data.device_capabilities;
        existing.signalStrength = parsed.data.signal_strength;
        existing.pairingStatus = parsed.data.pairing_status;
        existing.lastDiscovered = nowIso();
        await saveDb(db);
        res.json(existing);
        return;
    }
    const record = {
        id: createId(),
        userId: req.auth.userId,
        bluetoothMac: parsed.data.bluetooth_mac,
        deviceName: parsed.data.device_name,
        deviceCapabilities: parsed.data.device_capabilities,
        signalStrength: parsed.data.signal_strength,
        pairingStatus: parsed.data.pairing_status,
        lastDiscovered: nowIso(),
        createdAt: nowIso(),
    };
    db.bluetoothDevices.unshift(record);
    await saveDb(db);
    res.status(201).json(record);
});
app.patch("/api/bluetooth-devices/:id", requireAuth, async (req, res) => {
    const db = await loadDb();
    const device = db.bluetoothDevices.find((entry) => entry.id === req.params.id && entry.userId === req.auth.userId);
    if (!device) {
        res.status(404).json({ error: "Bluetooth device not found" });
        return;
    }
    if (typeof req.body.pairing_status === "string") {
        device.pairingStatus = req.body.pairing_status;
    }
    if (typeof req.body.device_id === "string") {
        device.deviceId = req.body.device_id;
    }
    device.lastDiscovered = nowIso();
    await saveDb(db);
    res.json(device);
});
app.delete("/api/bluetooth-devices/:id", requireAuth, async (req, res) => {
    const db = await loadDb();
    db.bluetoothDevices = db.bluetoothDevices.filter((entry) => !(entry.id === req.params.id && entry.userId === req.auth.userId));
    await saveDb(db);
    res.status(204).send();
});
app.delete("/api/file-transfers/:id", requireAuth, async (req, res) => {
    const db = await loadDb();
    const transfer = db.fileTransfers.find((entry) => entry.id === req.params.id && entry.userId === req.auth.userId);
    if (transfer?.filePath) {
        // Remove from Supabase Storage (fire-and-forget, do not block the response)
        supabase.storage.from(FILE_BUCKET).remove([transfer.filePath]).catch((err) => {
            console.error("Supabase Storage delete error:", err);
        });
    }
    db.fileTransfers = db.fileTransfers.filter((entry) => !(entry.id === req.params.id && entry.userId === req.auth.userId));
    await saveDb(db);
    res.status(204).send();
});
// 🔥 REAL-TIME FILE TRANSFER (SESSION BASED)
// Uses Supabase Storage so files survive server restarts on Render.
app.post("/api/send", async (req, res) => {
    const { sessionId, file } = req.body;
    if (!sessionId || !file) {
        return res.status(400).json({ error: "Missing sessionId or file" });
    }
    try {
        const buffer = Buffer.from(file, "base64");
        const { error } = await supabase.storage
            .from(SESSION_BUCKET)
            .upload(`sessions/${sessionId}`, buffer, {
            contentType: "application/octet-stream",
            upsert: true,
        });
        if (error) {
            console.error("Session upload error:", error);
            return res.status(500).json({ error: "Failed to store session file" });
        }
        res.json({ success: true });
    }
    catch (err) {
        console.error("Session send error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});
app.get("/api/receive/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    try {
        const { data, error } = await supabase.storage
            .from(SESSION_BUCKET)
            .download(`sessions/${sessionId}`);
        if (error || !data) {
            return res.status(404).json({ error: "No file yet" });
        }
        const arrayBuffer = await data.arrayBuffer();
        const file = Buffer.from(arrayBuffer).toString("base64");
        // Delete after retrieval (one-time pickup)
        supabase.storage
            .from(SESSION_BUCKET)
            .remove([`sessions/${sessionId}`])
            .catch((err) => console.error("Session cleanup error:", err));
        res.json({ file });
    }
    catch (err) {
        console.error("Session receive error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});
ensureDataDirs()
    .then(() => {
    app.listen(port, () => {
        console.log(`UniLink API listening on http://localhost:${port}`);
    });
})
    .catch((error) => {
    console.error("Failed to initialize storage", error);
    process.exit(1);
});
