import cors from "cors";
import express, { type Response } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { fileTypeFromBuffer } from "file-type";
import { randomInt, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Writable } from "node:stream";
import { z } from "zod";
import { supabase, FILE_BUCKET, SESSION_BUCKET } from "./supabase.js";
import { isEmailVerificationConfigured, isMailtrapDemoRestrictionError, sendRegistrationOtp } from "./mailer.js";
import { clearAuthCookies, comparePassword, createCsrfToken, hashPassword, requireAuth, requireCsrf, revokeToken, sanitizeUser, setAuthCookies, signAuthToken, signScopedToken, type AuthenticatedRequest } from "./auth.js";
import { decryptVaultContent, encryptVaultContent } from "./crypto.js";
import { containsNullBytes, ensureRelativeStoragePath, escapeHtml, isZipBombCandidate, nowIso, sanitizeFilename, sanitizeMimeType, sanitizeTextInput } from "./helpers.js";
import { createId, ensureDataDirs, loadDb, saveDb } from "./storage.js";
import type { AiSuggestionRecord, BluetoothDeviceRecord, ClipboardRecord, DeviceRecord, EmailVerificationRecord, FileTransferRecord, PairSessionRecord, UserRecord, VaultRecord } from "./types.js";
import { appConfig } from "./config.js";
import { createErrorHandler, HttpError, rejectDisallowedOrigin } from "./http.js";
import { httpLogger, logger } from "./logger.js";
const app = express();
const port = appConfig.port;
const nodeEnv = appConfig.nodeEnv;
const isProduction = appConfig.isProduction;
const allowedOrigins = appConfig.allowedOrigins;
const supabaseOrigin = (() => {
  const raw = appConfig.supabaseUrl || "";
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
})();
const supabaseStorageOrigin = (() => {
  const raw = appConfig.supabaseUrl || "";
  if (!raw) return null;
  try {
    return new URL(raw.replace(".supabase.co", ".storage.supabase.co")).origin;
  } catch {
    return null;
  }
})();

const isTrustedProductionOrigin = (origin: string) => {
  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();
    return hostname.endsWith(".onrender.com") && hostname.includes("unilink");
  } catch {
    return false;
  }
};

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(httpLogger);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    if (isProduction && isTrustedProductionOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Origin not allowed by CORS"));
  },
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
    "X-Upload-Id",
    "X-Chunk-Index",
    "X-Total-Chunks",
    "X-CSRF-Token",
  ],
  exposedHeaders: ["Content-Disposition"],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
}));
app.use(rejectDisallowedOrigin);
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down and try again." },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Please try again later." },
});
const tokenLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many token requests. Please try again later." },
});
const fileListLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many file listing requests. Please try again later." },
});
const syncLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many sync requests. Please try again later." },
});
const uploadLimiter = rateLimit({
  // Chunked uploads legitimately create many requests, so keep abuse protection
  // without throttling normal medium/large file transfers.
  windowMs: 15 * 60 * 1000,
  max: 1500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many upload requests. Please wait before uploading again." },
});
const MAX_SINGLE_FILE_SIZE = appConfig.maxFileSizeBytes;
const FREE_TOTAL_USER_STORAGE = 500 * 1024 * 1024;
const PRO_TOTAL_USER_STORAGE = 100 * 1024 * 1024 * 1024;
const FREE_MAX_ACTIVE_UPLOADS = 1;
const PRO_MAX_ACTIVE_UPLOADS = 10;
const MAX_FILES_PER_SELECTION = 10;
const FREE_FILE_SIZE_LIMIT = Math.max(100 * 1024 * 1024, MAX_SINGLE_FILE_SIZE);
const PRO_FILE_SIZE_LIMIT = Math.max(10 * 1024 * 1024 * 1024, MAX_SINGLE_FILE_SIZE);
// Keep moderate uploads synchronous so the UI can finish the transfer in one
// final response instead of lingering in a background processing state.
const SYNC_COMPLETE_UPLOAD_LIMIT_BYTES = 256 * 1024 * 1024;
const MONTH_IN_MS = 30 * 24 * 60 * 60 * 1000;
const OTP_FALLBACK_ENABLED = appConfig.allowOtpFallback;
const DEMO_GOOGLE_LOGIN_ENABLED = !isProduction && appConfig.allowDemoGoogleLogin;
const strictContentSecurityPolicyDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  fontSrc: ["'self'", "https://fonts.gstatic.com"],
  imgSrc: ["'self'", "data:", "blob:", "https://api.qrserver.com", ...(supabaseOrigin ? [supabaseOrigin] : []), ...(supabaseStorageOrigin ? [supabaseStorageOrigin] : [])],
  mediaSrc: ["'self'", "blob:", ...(supabaseOrigin ? [supabaseOrigin] : []), ...(supabaseStorageOrigin ? [supabaseStorageOrigin] : [])],
  connectSrc: ["'self'", ...allowedOrigins, ...(supabaseOrigin ? [supabaseOrigin] : []), ...(supabaseStorageOrigin ? [supabaseStorageOrigin] : [])],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  frameAncestors: ["'none'"],
  formAction: ["'self'"],
};

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: strictContentSecurityPolicyDirectives,
    },
    hsts: isProduction
      ? {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        }
      : false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
  }),
);
app.use((_req, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});
app.use(globalLimiter);
app.get("/admin", (req, res) => {
  logger.warn({ ip: req.ip, userAgent: req.headers["user-agent"] }, "Honeypot route hit");
  res.json({ status: "ok", system: "public", message: "No administrative access exposed." });
});
// Skip body parsing for the binary file upload route — it reads req stream directly
app.use((req, res, next) => {
  if (req.path === "/api/file-transfers/upload" || req.path === "/api/file-transfers/chunk") return next();
  express.json({ limit: "2mb" })(req, res, next);
});
app.use((req, res, next) => {
  if (req.path === "/api/file-transfers/upload" || req.path === "/api/file-transfers/chunk") return next();
  express.urlencoded({ extended: true, limit: "2mb" })(req, res, next);
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

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "New passwords do not match",
    path: ["confirmPassword"],
  });

const twoFactorRequestSchema = z.object({
  mobileNumber: z.string().trim().min(8).max(24),
});

const twoFactorVerifySchema = z.object({
  otp: z.string().trim().length(6),
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

const uploadInitSchema = z.object({
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

const sessionTransferSchema = z.object({
  sessionId: z.string().trim().min(1).max(160),
  file: z.string().min(1),
});

const sessionIdSchema = z.object({
  sessionId: z.string().trim().min(1).max(160),
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

const uploadChunkHeadersSchema = z.object({
  "x-upload-id": z.string().trim().min(1),
  "x-chunk-index": z.coerce.number().int().min(0),
  "x-total-chunks": z.coerce.number().int().min(1),
});

interface PendingUploadSession {
  id: string;
  userId: string;
  transferId: string;
  fileName: string;
  fileSize: number;
  fileType?: string;
  senderDeviceId: string;
  receiverDeviceId?: string;
  transferMethod: "cloud" | "p2p" | "local";
  storagePath: string;
  tempDir: string;
  chunkSize: number;
  totalChunks: number;
  createdAt: string;
  updatedAt: string;
  uploadedChunks: Set<number>;
  isCompleting?: boolean;
  isDirectUpload?: boolean;
}

const uploadSessions = new Map<string, PendingUploadSession>();
const LARGE_UPLOAD_CHUNK_BYTES = 50 * 1024 * 1024;
const UPLOAD_TEMP_ROOT = path.join(os.tmpdir(), "unilink-upload-sessions");
const UPLOAD_SESSION_STALE_MS = 30 * 60 * 1000;
const UPLOAD_REQUEST_TIMEOUT_MS = 15 * 60 * 1000;
const ALLOWED_UPLOAD_MIME_PREFIXES = ["image/", "video/", "audio/", "text/", "application/"];
const ALLOWED_EXACT_MIME_TYPES = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
]);

const isSubscriptionActive = (user: UserRecord) =>
  user.role === "admin" ||
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

const normalizeEmail = (email: string) => sanitizeTextInput(email, 120).toLowerCase();

const isLikelyRealEmail = (email: string) => {
  const normalized = normalizeEmail(email);
  const [, domain = ""] = normalized.split("@");
  return Boolean(domain) && !blockedEmailDomains.has(domain);
};

const assertValidEmailAddress = (email: string) => {
  if (!isLikelyRealEmail(email)) {
    return "Enter a valid email address";
  }
  return null;
};

const createOtp = () => `${randomInt(100000, 1000000)}`;

const isStrongPassword = (password: string) =>
  password.length >= 8 && /[^A-Za-z0-9]/.test(password);

const isValidMobileNumber = (mobileNumber: string) =>
  /^\+\d{1,3}\s\d{4}-\d{6}$/.test(mobileNumber.trim());

const getLatestEmailVerification = (
  db: Awaited<ReturnType<typeof loadDb>>,
  email: string,
) =>
  db.emailVerifications
    .filter((entry) => entry.email === email && entry.purpose === "register")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null;

const isEmailVerificationValid = (verification: EmailVerificationRecord | null) =>
  Boolean(
    verification &&
      verification.verifiedAt &&
      new Date(verification.expiresAt).getTime() > Date.now(),
  );

const consumeExpiredEmailVerifications = (db: Awaited<ReturnType<typeof loadDb>>) => {
  db.emailVerifications = db.emailVerifications.filter(
    (entry) => new Date(entry.expiresAt).getTime() > Date.now(),
  );
};

const registrationOtpFallbackResponse = (message: string, otp: string) => ({
  success: true,
  message,
  developmentOtp: otp,
  deliveryMode: "fallback" as const,
});

const refreshUserPlan = (user: UserRecord) => {
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

const getUserFileLimit = (user: UserRecord) =>
  isSubscriptionActive(user) ? PRO_FILE_SIZE_LIMIT : FREE_FILE_SIZE_LIMIT;

const getUserTotalStorageLimit = (user: UserRecord) =>
  isSubscriptionActive(user) ? PRO_TOTAL_USER_STORAGE : FREE_TOTAL_USER_STORAGE;

const getMaxActiveUploadsForUser = (user: UserRecord) =>
  isSubscriptionActive(user) ? PRO_MAX_ACTIVE_UPLOADS : FREE_MAX_ACTIVE_UPLOADS;

const FREE_CLIPBOARD_WORD_LIMIT = 100;
const PRO_CLIPBOARD_WORD_LIMIT = 5000;
const FREE_CLIPBOARD_MESSAGE_LIMIT = 10;

const countWords = (content: string) =>
  content
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

const getClipboardWordLimit = (user: UserRecord) =>
  isSubscriptionActive(user) ? PRO_CLIPBOARD_WORD_LIMIT : FREE_CLIPBOARD_WORD_LIMIT;

const bytesToLabel = (bytes: number) => {
  if (bytes >= 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024 * 1024))} GB`;
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
};

const formatLimitLabel = (bytes: number) => bytesToLabel(bytes);

const getUploadLimitMessage = (user: UserRecord, limit: number) =>
  isSubscriptionActive(user)
    ? `Your Pro plan supports files up to ${formatLimitLabel(limit)}.`
    : `Your current plan supports files up to ${formatLimitLabel(limit)}.`;

const sanitizeStoredFileName = (fileName: string) => sanitizeFilename(fileName).slice(0, 140);
const FILE_EXTENSION_REGEX = /\.[a-z0-9]{1,10}$/i;

const createStorageObjectPath = (userId: string, fileName: string) => {
  const extension = fileName.match(FILE_EXTENSION_REGEX)?.[0]?.toLowerCase() || "";
  return ensureRelativeStoragePath(`${userId}/${randomUUID()}${extension}`);
};

const isAllowedMimeType = (mimeType?: string) => {
  // Allow all file types to prevent valid generic binary files from being rejected
  // due to missing or incorrect browser MIME type mappings.
  return true;
};

const assertAllowedMimeType = (mimeType?: string) => {
  if (!isAllowedMimeType(mimeType)) {
    return "Unsupported file type. Allowed types: images, videos, audio, text, PDF, and ZIP.";
  }
  return null;
};

const calculateUserStorageUsage = (db: Awaited<ReturnType<typeof loadDb>>, userId: string) =>
  db.fileTransfers
    .filter(
      (transfer) =>
        transfer.userId === userId &&
        transfer.transferStatus !== "failed" &&
        transfer.transferStatus !== "cancelled",
    )
    .reduce((total, transfer) => total + transfer.fileSize, 0);

const getActiveUploadCountForUser = (userId: string) =>
  Array.from(uploadSessions.values()).filter((session) => session.userId === userId).length;

const assertUploadConstraints = (
  db: Awaited<ReturnType<typeof loadDb>>,
  user: UserRecord,
  fileName: string,
  fileSize: number,
  fileType?: string,
) => {
  const cleanedFileName = sanitizeStoredFileName(fileName);
  const mimeTypeError = assertAllowedMimeType(fileType);
  if (mimeTypeError) {
    return { status: 400, error: mimeTypeError };
  }

  if (cleanedFileName !== fileName && sanitizeStoredFileName(cleanedFileName) !== cleanedFileName) {
    return { status: 400, error: "Invalid file name." };
  }

  const perFileLimit = getUserFileLimit(user);
  if (fileSize > perFileLimit) {
    return {
      status: 413,
      error: getUploadLimitMessage(user, perFileLimit),
      fileLimit: perFileLimit,
    };
  }

  const projectedUsage = calculateUserStorageUsage(db, user.id) + fileSize;
  const totalStorageLimit = getUserTotalStorageLimit(user);
  if (projectedUsage > totalStorageLimit) {
    return {
      status: 413,
      error: `Storage quota exceeded. Your plan currently allows up to ${bytesToLabel(totalStorageLimit)} total data per account.`,
    };
  }

  const maxActiveUploadsForUser = getMaxActiveUploadsForUser(user);
  if (getActiveUploadCountForUser(user.id) >= maxActiveUploadsForUser) {
    return {
      status: 429,
      error: `Too many active uploads. Please wait for current uploads to finish before starting more than ${maxActiveUploadsForUser}.`,
    };
  }

  return null;
};

const scanUploadedPayload = async (_fileName: string, _mimeType: string, _size: number) => {
  // Placeholder for future ClamAV integration.
  // In production, replace with a real scan and block upload when malware is detected.
  return { clean: true };
};

const validateUploadedFileBuffer = async (
  fileBuffer: Buffer,
  declaredMimeType: string,
  declaredSize: number,
) => {
  const detectedFileType = await fileTypeFromBuffer(fileBuffer);
  const effectiveMimeType = detectedFileType?.mime || declaredMimeType;

  if (!isAllowedMimeType(effectiveMimeType)) {
    return "Unsupported file type. Allowed types: images, videos, audio, text, PDF, and ZIP.";
  }

  if (isZipBombCandidate(effectiveMimeType, declaredSize, fileBuffer.length)) {
    return "Compressed archive appears unsafe.";
  }

  return null;
};

const parseUploadHeaders = (headers: express.Request["headers"]) =>
  uploadHeadersSchema.safeParse({
    "x-file-name":
      typeof headers["x-file-name"] === "string"
        ? decodeURIComponent(headers["x-file-name"])
        : headers["x-file-name"],
    "x-file-size": headers["x-file-size"],
    "x-file-type": headers["x-file-type"],
    "x-sender-device-id": headers["x-sender-device-id"],
    "x-receiver-device-id": headers["x-receiver-device-id"],
    "x-transfer-method": headers["x-transfer-method"],
  });

const parseUploadChunkHeaders = (headers: express.Request["headers"]) =>
  uploadChunkHeadersSchema.safeParse({
    "x-upload-id": headers["x-upload-id"],
    "x-chunk-index": headers["x-chunk-index"],
    "x-total-chunks": headers["x-total-chunks"],
  });

const getOwnedTransfer = (
  db: Awaited<ReturnType<typeof loadDb>>,
  userId: string,
  transferId: string,
) => db.fileTransfers.find((entry) => entry.id === transferId && entry.userId === userId) || null;

const getUploadChunkPath = (session: PendingUploadSession, chunkIndex: number) =>
  path.join(session.tempDir, `${String(chunkIndex).padStart(6, "0")}.part`);

const getUploadedChunkIndices = async (session: PendingUploadSession) => {
  if (session.uploadedChunks.size > 0) {
    return Array.from(session.uploadedChunks).sort((a, b) => a - b);
  }

  const entries = await readdir(session.tempDir).catch(() => []);
  const uploadedChunks = entries
    .filter((entry) => entry.endsWith(".part"))
    .map((entry) => Number.parseInt(entry.replace(".part", ""), 10))
    .filter((value) => Number.isInteger(value) && value >= 0 && value < session.totalChunks)
    .sort((a, b) => a - b);

  session.uploadedChunks = new Set(uploadedChunks);
  return uploadedChunks;
};

const cleanupUploadSession = async (session: PendingUploadSession | undefined | null) => {
  if (!session) return;
  uploadSessions.delete(session.id);
  await rm(session.tempDir, { recursive: true, force: true }).catch(() => undefined);
};

const findUploadSessionByTransferId = (transferId: string, userId: string) =>
  Array.from(uploadSessions.values()).find(
    (session) => session.transferId === transferId && session.userId === userId,
  ) || null;

const getChunkStoragePath = (storagePath: string, chunkIndex: number) =>
  ensureRelativeStoragePath(`${storagePath}/chunks/${String(chunkIndex).padStart(6, "0")}.part`);

const createPendingUploadSession = async (
  transfer: FileTransferRecord,
): Promise<PendingUploadSession | null> => {
  if (transfer.transferStatus !== "in_progress" || !transfer.filePath || !transfer.uploadSessionId) {
    return null;
  }

  const tempDir = transfer.uploadTempDir || path.join(UPLOAD_TEMP_ROOT, transfer.uploadSessionId);
  await mkdir(tempDir, { recursive: true });

  const session: PendingUploadSession = {
    id: transfer.uploadSessionId,
    userId: transfer.userId,
    transferId: transfer.id,
    fileName: transfer.fileName,
    fileSize: transfer.fileSize,
    fileType: transfer.fileType,
    senderDeviceId: transfer.senderDeviceId,
    receiverDeviceId: transfer.receiverDeviceId,
    transferMethod: transfer.transferMethod,
    storagePath: transfer.filePath,
    tempDir,
    chunkSize: transfer.uploadChunkSize || LARGE_UPLOAD_CHUNK_BYTES,
    totalChunks:
      transfer.uploadTotalChunks || Math.max(1, Math.ceil(transfer.fileSize / (transfer.uploadChunkSize || LARGE_UPLOAD_CHUNK_BYTES))),
    createdAt: transfer.createdAt,
    updatedAt: transfer.uploadUpdatedAt || transfer.createdAt,
    uploadedChunks: new Set<number>(transfer.uploadUploadedChunks || []),
    isDirectUpload: false,
  };

  const uploadedChunks = await getUploadedChunkIndices(session);
  session.uploadedChunks = new Set(uploadedChunks);
  uploadSessions.set(session.id, session);
  return session;
};

const getActiveUploadSessionById = async (uploadId: string, userId: string) => {
  const existingSession = uploadSessions.get(uploadId);
  if (existingSession && existingSession.userId === userId) {
    return existingSession;
  }

  const db = await loadDb();
  const transfer = db.fileTransfers.find(
    (entry) =>
      entry.userId === userId &&
      entry.uploadSessionId === uploadId &&
      entry.transferStatus === "in_progress",
  );
  if (!transfer) {
    return null;
  }

  return createPendingUploadSession(transfer);
};

const getActiveUploadSessionByTransferId = async (transferId: string, userId: string) => {
  const existingSession = findUploadSessionByTransferId(transferId, userId);
  if (existingSession) {
    return existingSession;
  }

  const db = await loadDb();
  const transfer = getOwnedTransfer(db, userId, transferId);
  if (!transfer?.uploadSessionId || transfer.transferStatus !== "in_progress") {
    return null;
  }

  return createPendingUploadSession(transfer);
};

const removeStoredTransferArtifacts = async (transfer?: FileTransferRecord | null) => {
  if (!transfer?.filePath) return;

  if (transfer.storageMode === "chunked") {
    const chunkTotal = transfer.uploadTotalChunks || 0;
    const chunkPaths = Array.from({ length: chunkTotal }, (_, index) =>
      getChunkStoragePath(transfer.filePath!, index),
    );
    if (chunkPaths.length > 0) {
      const { error } = await supabase.storage.from(FILE_BUCKET).remove(chunkPaths);
      if (error) {
        console.error("Supabase Storage chunk delete error:", error);
      }
    }
    return;
  }

  const { error } = await supabase.storage
    .from(FILE_BUCKET)
    .remove([ensureRelativeStoragePath(transfer.filePath)]);
  if (error) {
    console.error("Supabase Storage delete error:", error);
  }
};

const removeStoredTransferFile = async (filePath?: string | null) => {
  if (!filePath) return;
  const { error } = await supabase.storage
    .from(FILE_BUCKET)
    .remove([ensureRelativeStoragePath(filePath)]);
  if (error) {
    console.error("Supabase Storage delete error:", error);
  }
};

const cleanupStaleUploadSessions = async () => {
  const cutoff = Date.now() - UPLOAD_SESSION_STALE_MS;
  const staleSessions = Array.from(uploadSessions.values()).filter(
    (session) => new Date(session.updatedAt || session.createdAt).getTime() < cutoff,
  );

  if (staleSessions.length === 0) return;

  const db = await loadDb();
  let dbChanged = false;

  for (const session of staleSessions) {
    const transfer = db.fileTransfers.find(
      (entry) => entry.id === session.transferId && entry.userId === session.userId,
    );
    if (transfer && transfer.transferStatus === "in_progress") {
      transfer.transferStatus = "failed";
      transfer.completedAt = nowIso();
      dbChanged = true;
    }
    await cleanupUploadSession(session);
  }

  if (dbChanged) {
    await saveDb(db);
  }

  const persistedStaleTransfers = db.fileTransfers.filter(
    (transfer) =>
      transfer.transferStatus === "in_progress" &&
      Boolean(transfer.uploadSessionId) &&
      new Date(transfer.uploadUpdatedAt || transfer.createdAt).getTime() < cutoff,
  );

  if (persistedStaleTransfers.length === 0) {
    return;
  }

  let persistedDbChanged = false;
  for (const transfer of persistedStaleTransfers) {
    const activeSession = transfer.uploadSessionId ? uploadSessions.get(transfer.uploadSessionId) : null;
    if (activeSession) {
      await cleanupUploadSession(activeSession);
    }

    await removeStoredTransferArtifacts(transfer);

    transfer.transferStatus = "failed";
    transfer.completedAt = nowIso();
    persistedDbChanged = true;
  }

  if (persistedDbChanged) {
    await saveDb(db);
  }
};

const userResponse = (user: UserRecord) => {
  refreshUserPlan(user);
  return sanitizeUser(user);
};

const findUser = async (userId: string) => {
  const db = await loadDb();
  const user = db.users.find((entry) => entry.id === userId) || null;
  if (user && refreshUserPlan(user)) {
    await saveDb(db);
  }
  return user;
};

const getLanAddress = () => {
  const interfaces = os.networkInterfaces();
  for (const interfaceName of Object.keys(interfaces)) {
    const network = interfaces[interfaceName] || [];
    for (const entry of network) {
      if (entry.family === "IPv4" && !entry.internal) {
        return entry.address;
      }
    }
  }
  return "localhost";
};

const getAppBaseUrl = (req: express.Request) => {
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

const buildPairSession = (userId: string): PairSessionRecord => {
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

const isPairSessionExpired = (session: PairSessionRecord) =>
  Boolean(session.usedAt) || new Date(session.expiresAt).getTime() <= Date.now();

app.get("/api/health", async (_req, res) => {
  try {
    await loadDb();
    res.json({ status: "ok", uptime: process.uptime(), db: "connected" });
  } catch {
    res.status(503).json({ status: "error", uptime: process.uptime(), db: "error" });
  }
});

app.post("/api/auth/request-registration-otp", tokenLimiter, async (req, res) => {
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

  try {
    const db = await loadDb();
    consumeExpiredEmailVerifications(db);

    if (db.users.some((user) => normalizeEmail(user.email) === email)) {
      res.status(409).json({ error: "Email is already registered" });
      return;
    }

    const otp = createOtp();
    const timestamp = nowIso();
    const verification: EmailVerificationRecord = {
      id: createId(),
      email,
      purpose: "register",
      otpHash: await hashPassword(otp),
      createdAt: timestamp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };

    db.emailVerifications = db.emailVerifications.filter(
      (entry) => !(entry.email === email && entry.purpose === "register"),
    );
    db.emailVerifications.unshift(verification);
    await saveDb(db);

    if (!isEmailVerificationConfigured()) {
      if (OTP_FALLBACK_ENABLED) {
        res.json(
          registrationOtpFallbackResponse(
            "Email delivery is not configured right now. Use the temporary OTP shown below to continue signup.",
            otp,
          ),
        );
        return;
      }

      res.status(503).json({
        error: "Email verification is not configured yet. Add SMTP settings on the server first.",
      });
      return;
    }

    try {
      await sendRegistrationOtp(email, otp);

      res.json({
        success: true,
        message: "Verification code sent to your email.",
      });
      return;
    } catch (mailError) {
      if (OTP_FALLBACK_ENABLED) {
        const fallbackMessage = isMailtrapDemoRestrictionError(mailError)
          ? "Email delivery is in testing mode. Use the temporary OTP shown below."
          : "Email delivery is temporarily unavailable. Use the temporary OTP shown below to continue signup.";

        res.json(registrationOtpFallbackResponse(fallbackMessage, otp));
        return;
      }

      throw mailError;
    }
  } catch (error) {
    console.error("Registration OTP error:", error);
    res.status(500).json({ error: "Failed to send the verification code. Please try again." });
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
  } catch (error) {
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
    const user: UserRecord = {
      id: createId(),
      email,
      firstName: sanitizeTextInput(parsed.data.firstName, 60),
      lastName: sanitizeTextInput(parsed.data.lastName, 60),
      passwordHash: await hashPassword(parsed.data.password),
      createdAt: timestamp,
      updatedAt: timestamp,
      plan: "free",
      preferences: {
        aiAssistantEnabled: true,
      },
    };

    db.users.push(user);
    db.emailVerifications = db.emailVerifications.filter(
      (entry) => !(entry.email === email && entry.purpose === "register"),
    );
    await saveDb(db);
    const { token } = signAuthToken(user);
    const csrfToken = createCsrfToken();
    setAuthCookies(res, token, csrfToken, false);

    res.status(201).json({
      token,
      csrfToken,
      user: userResponse(user),
    });
  } catch (error) {
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
    const user = db.users.find((entry) => normalizeEmail(entry.email) === email);

    if (!user || !(await comparePassword(parsed.data.password, user.passwordHash))) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    if (refreshUserPlan(user)) {
      await saveDb(db);
    }
    const { token } = signAuthToken(user, parsed.data.rememberMe);
    const csrfToken = createCsrfToken();
    setAuthCookies(res, token, csrfToken, Boolean(parsed.data.rememberMe));

    res.json({
      token,
      csrfToken,
      user: userResponse(user),
    });
  } catch (error) {
    console.error("Login lookup error:", error);
    res.status(500).json({ error: "Unable to sign in right now. Please try again." });
  }
});

app.post("/api/auth/google", tokenLimiter, async (req, res) => {
  if (!DEMO_GOOGLE_LOGIN_ENABLED) {
    res.status(501).json({ error: "Google login is not configured." });
    return;
  }

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
    const { token } = signAuthToken(user, parsed.data.rememberMe);
    const csrfToken = createCsrfToken();
    setAuthCookies(res, token, csrfToken, Boolean(parsed.data.rememberMe));

    res.json({
      token,
      csrfToken,
      user: userResponse(user),
    });
  } catch (error) {
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
  } catch (error) {
    console.error("Forgot password lookup error:", error);
    res.status(500).json({ error: "Unable to start password reset support right now." });
  }
});

app.post("/api/auth/change-password", requireAuth, requireCsrf, async (req: AuthenticatedRequest, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    res.status(400).json({ error: issue?.message || "Invalid password update request" });
    return;
  }

  if (!isStrongPassword(parsed.data.newPassword)) {
    res.status(400).json({
      error: "Password must be at least 8 characters and include a special symbol.",
    });
    return;
  }

  try {
    const db = await loadDb();
    const user = db.users.find((entry) => entry.id === req.auth!.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const passwordMatches = await comparePassword(parsed.data.currentPassword, user.passwordHash);
    if (!passwordMatches) {
      res.status(400).json({ error: "Current password is incorrect." });
      return;
    }

    if (await comparePassword(parsed.data.newPassword, user.passwordHash)) {
      res.status(400).json({ error: "Choose a new password different from the current one." });
      return;
    }

    user.passwordHash = await hashPassword(parsed.data.newPassword);
    user.updatedAt = nowIso();
    await saveDb(db);

    res.json({ success: true, message: "Password changed successfully." });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Unable to change password right now." });
  }
});

app.post("/api/auth/request-2fa-otp", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = twoFactorRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid mobile number." });
    return;
  }

  const mobileNumber = parsed.data.mobileNumber.trim();
  if (!isValidMobileNumber(mobileNumber)) {
    res.status(400).json({ error: "Use the format +91 1234-123456" });
    return;
  }

  try {
    const db = await loadDb();
    const user = db.users.find((entry) => entry.id === req.auth!.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const otp = createOtp();
    user.preferences.twoFactorPhone = mobileNumber;
    user.preferences.twoFactorOtpHash = await hashPassword(otp);
    user.preferences.twoFactorOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    user.preferences.twoFactorEnabled = false;
    user.updatedAt = nowIso();
    await saveDb(db);

    res.json({
      success: true,
      message: "Temporary OTP generated for this mobile number.",
      developmentOtp: otp,
    });
  } catch (error) {
    console.error("Request 2FA OTP error:", error);
    res.status(500).json({ error: "Unable to generate OTP right now." });
  }
});

app.post("/api/auth/verify-2fa-otp", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = twoFactorVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter the 6-digit OTP." });
    return;
  }

  try {
    const db = await loadDb();
    const user = db.users.find((entry) => entry.id === req.auth!.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const otpHash = user.preferences.twoFactorOtpHash;
    const expiresAt = user.preferences.twoFactorOtpExpiresAt;
    if (!otpHash || !expiresAt || new Date(expiresAt).getTime() <= Date.now()) {
      res.status(400).json({ error: "OTP expired. Request a new OTP." });
      return;
    }

    const otpMatches = await comparePassword(parsed.data.otp, otpHash);
    if (!otpMatches) {
      res.status(400).json({ error: "Invalid OTP." });
      return;
    }

    user.preferences.twoFactorEnabled = true;
    user.preferences.twoFactorVerifiedAt = nowIso();
    user.preferences.twoFactorOtpHash = undefined;
    user.preferences.twoFactorOtpExpiresAt = undefined;
    user.updatedAt = nowIso();
    await saveDb(db);

    res.json({
      success: true,
      message: "Two-factor authentication enabled successfully.",
      user: userResponse(user),
    });
  } catch (error) {
    console.error("Verify 2FA OTP error:", error);
    res.status(500).json({ error: "Unable to verify OTP right now." });
  }
});

app.post("/api/auth/disable-2fa", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const db = await loadDb();
    const user = db.users.find((entry) => entry.id === req.auth!.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    user.preferences.twoFactorEnabled = false;
    user.preferences.twoFactorOtpHash = undefined;
    user.preferences.twoFactorOtpExpiresAt = undefined;
    user.updatedAt = nowIso();
    await saveDb(db);

    res.json({
      success: true,
      message: "Two-factor authentication disabled.",
      user: userResponse(user),
    });
  } catch (error) {
    console.error("Disable 2FA error:", error);
    res.status(500).json({ error: "Unable to disable 2FA right now." });
  }
});

app.get("/api/auth/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = await findUser(req.auth!.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ user: userResponse(user) });
});

app.post("/api/billing/subscribe", requireAuth, requireCsrf, async (req: AuthenticatedRequest, res) => {
  const parsed = billingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid subscription request" });
    return;
  }

  const db = await loadDb();
  const user = db.users.find((entry) => entry.id === req.auth!.userId);
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

app.post("/api/pair-sessions", requireAuth, async (req: AuthenticatedRequest, res) => {
  const db = await loadDb();
  db.pairSessions = db.pairSessions.filter((session) => !isPairSessionExpired(session));
  const appBaseUrl = getAppBaseUrl(req);

  const existing = db.pairSessions.find((session) => session.userId === req.auth!.userId && !isPairSessionExpired(session));
  if (existing) {
    await saveDb(db);
    res.status(201).json({
      ...existing,
      connectUrl: `${appBaseUrl}/connect/${existing.code}`,
    });
    return;
  }

  const session = buildPairSession(req.auth!.userId);
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
  let device = db.devices.find(
    (entry) => entry.userId === user.id && entry.deviceId === parsed.data.deviceId,
  );

  if (device) {
    device.deviceName = parsed.data.deviceName;
    device.deviceType = parsed.data.deviceType;
    device.platform = parsed.data.platform;
    device.lastSeen = timestamp;
    device.isActive = true;
    device.updatedAt = timestamp;
  } else {
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
    token: signAuthToken(user, true).token,
    user: userResponse(user),
    device,
  });
});

app.patch("/api/auth/profile", requireAuth, requireCsrf, async (req: AuthenticatedRequest, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid profile update" });
    return;
  }

  const db = await loadDb();
  const user = db.users.find((entry) => entry.id === req.auth!.userId);
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

app.get("/api/devices", requireAuth, async (req: AuthenticatedRequest, res) => {
  const db = await loadDb();
  const devices = db.devices
    .filter((device) => device.userId === req.auth!.userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  res.json(devices);
});

app.post("/api/devices", requireAuth, requireCsrf, async (req: AuthenticatedRequest, res) => {
  const parsed = deviceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid device payload" });
    return;
  }

  const db = await loadDb();
  const timestamp = nowIso();
  const existing = db.devices.find(
    (device) => device.userId === req.auth!.userId && device.deviceId === parsed.data.deviceId,
  );

  const isGenericDeviceName = (value: string) =>
    /^(browser|chrome|edge|firefox|safari|opera)$/i.test(value.trim()) ||
    /^browser on [a-z0-9 _-]+$/i.test(value.trim()) ||
    /^(chrome|edge|firefox|safari|opera) on [a-z0-9 _-]+$/i.test(value.trim()) ||
    /^[a-z0-9 _-]+ browser$/i.test(value.trim());

  if (existing) {
    const incomingName = parsed.data.deviceName.trim();
    const shouldPreserveExistingName =
      existing.deviceName.trim() &&
      !isGenericDeviceName(existing.deviceName) &&
      isGenericDeviceName(incomingName);

    existing.deviceName = shouldPreserveExistingName ? existing.deviceName : incomingName;
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

  const device: DeviceRecord = {
    id: createId(),
    userId: req.auth!.userId,
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

app.patch("/api/devices/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  const db = await loadDb();
  const device = db.devices.find(
    (entry) => entry.id === req.params.id && entry.userId === req.auth!.userId,
  );
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

app.delete("/api/devices/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  const db = await loadDb();
  db.devices = db.devices.filter(
    (entry) => !(entry.id === req.params.id && entry.userId === req.auth!.userId),
  );
  await saveDb(db);
  res.status(204).send();
});

app.get("/api/clipboard", requireAuth, async (req: AuthenticatedRequest, res) => {
  const db = await loadDb();
  res.json(
    db.clipboard
      .filter((item) => item.userId === req.auth!.userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
});

app.post("/api/clipboard", syncLimiter, requireAuth, requireCsrf, async (req: AuthenticatedRequest, res) => {
  const parsed = clipboardSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid clipboard payload" });
    return;
  }

  const db = await loadDb();
  const user = db.users.find((entry) => entry.id === req.auth!.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (refreshUserPlan(user)) {
    await saveDb(db);
  }

  const content = sanitizeTextInput(parsed.data.content, 10000);
  const wordCount = countWords(content);
  const wordLimit = getClipboardWordLimit(user);
  if (wordCount > wordLimit) {
    res.status(400).json({
      error: isSubscriptionActive(user)
        ? `Clipboard messages can contain up to ${PRO_CLIPBOARD_WORD_LIMIT} words on Pro.`
        : `Free plan clipboard messages can contain up to ${FREE_CLIPBOARD_WORD_LIMIT} words. Upgrade to Pro for ${PRO_CLIPBOARD_WORD_LIMIT}-word messages.`,
    });
    return;
  }

  const existingMessages = db.clipboard.filter((item) => item.userId === req.auth!.userId);
  if (!isSubscriptionActive(user) && existingMessages.length >= FREE_CLIPBOARD_MESSAGE_LIMIT) {
    res.status(400).json({
      error: `Free plan allows up to ${FREE_CLIPBOARD_MESSAGE_LIMIT} clipboard messages. Delete an old message or upgrade to Pro for unlimited clipboard history.`,
    });
    return;
  }

  const devices = db.devices.filter((device) => device.userId === req.auth!.userId);
  const item: ClipboardRecord = {
    id: createId(),
    userId: req.auth!.userId,
    deviceId: parsed.data.device_id,
    content,
    contentType: parsed.data.content_type,
    syncTimestamp: nowIso(),
    syncedToDevices: devices.map((device) => device.id).filter((id) => id !== parsed.data.device_id),
    createdAt: nowIso(),
  };
  db.clipboard.unshift(item);
  if (!isSubscriptionActive(user)) {
    const currentUserItems = db.clipboard
      .filter((entry) => entry.userId === req.auth!.userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const allowedIds = new Set(
      currentUserItems.slice(0, FREE_CLIPBOARD_MESSAGE_LIMIT).map((entry) => entry.id),
    );
    db.clipboard = db.clipboard.filter(
      (entry) => entry.userId !== req.auth!.userId || allowedIds.has(entry.id),
    );
  }
  await saveDb(db);
  res.status(201).json(item);
});

app.delete("/api/clipboard/:id", syncLimiter, requireAuth, requireCsrf, async (req: AuthenticatedRequest, res) => {
  const db = await loadDb();
  db.clipboard = db.clipboard.filter(
    (entry) => !(entry.id === req.params.id && entry.userId === req.auth!.userId),
  );
  await saveDb(db);
  res.status(204).send();
});

app.get("/api/file-transfers", fileListLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
  const db = await loadDb();
  res.json(
    db.fileTransfers
      .filter((transfer) => transfer.userId === req.auth!.userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
});

app.post("/api/file-transfers/initiate", uploadLimiter, requireAuth, requireCsrf, async (req: AuthenticatedRequest, res) => {
  await cleanupStaleUploadSessions();
  const parsed = uploadInitSchema.safeParse(req.body);
  if (!parsed.success) {
    const errorDetails = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    res.status(400).json({ error: `Invalid upload metadata: ${errorDetails}` });
    return;
  }

  const db = await loadDb();
  const user = db.users.find((entry) => entry.id === req.auth!.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (refreshUserPlan(user)) {
    await saveDb(db);
  }

  const sanitizedFileName = sanitizeStoredFileName(parsed.data.fileName);
  const sanitizedFileType = sanitizeMimeType(parsed.data.fileType);
  const uploadConstraintError = assertUploadConstraints(
    db,
    user,
    sanitizedFileName,
    parsed.data.fileSize,
    sanitizedFileType,
  );
  if (uploadConstraintError) {
    res.status(uploadConstraintError.status).json({
      error: uploadConstraintError.error,
      fileLimit: getUserFileLimit(user),
      plan: isSubscriptionActive(user) ? "pro" : "free",
    });
    return;
  }

  const transferId = createId();
  const uploadId = createId();
  const storagePath = ensureRelativeStoragePath(
    `${req.auth!.userId}/${randomUUID()}-${sanitizedFileName}`,
  );
  const tempDir = path.join(UPLOAD_TEMP_ROOT, uploadId);
  await mkdir(tempDir, { recursive: true });

  const session: PendingUploadSession = {
    id: uploadId,
    userId: req.auth!.userId,
    transferId,
    fileName: sanitizedFileName,
    fileSize: parsed.data.fileSize,
    fileType: sanitizedFileType,
    senderDeviceId: parsed.data.senderDeviceId,
    receiverDeviceId: parsed.data.receiverDeviceId,
    transferMethod: parsed.data.transferMethod,
    storagePath,
    tempDir,
    chunkSize: LARGE_UPLOAD_CHUNK_BYTES,
    totalChunks: Math.ceil(parsed.data.fileSize / LARGE_UPLOAD_CHUNK_BYTES),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    uploadedChunks: new Set<number>(),
    isDirectUpload: false,
  };

  uploadSessions.set(uploadId, session);

  const transfer: FileTransferRecord = {
    id: transferId,
    userId: req.auth!.userId,
    senderDeviceId: parsed.data.senderDeviceId,
    receiverDeviceId: parsed.data.receiverDeviceId,
    fileName: sanitizedFileName,
    fileSize: parsed.data.fileSize,
    fileType: sanitizedFileType,
    transferStatus: "in_progress",
    transferMethod: parsed.data.transferMethod,
    createdAt: session.createdAt,
    filePath: storagePath,
    storageMode: "chunked",
    uploadSessionId: session.id,
    uploadTempDir: tempDir,
    uploadChunkSize: session.chunkSize,
    uploadTotalChunks: session.totalChunks,
    uploadUpdatedAt: session.updatedAt,
  };

  db.fileTransfers = [transfer, ...db.fileTransfers.filter((entry) => entry.id !== transfer.id)];
  await saveDb(db);

  res.status(201).json({
    uploadId: session.id,
    transferId: session.transferId,
    chunkSize: session.chunkSize,
    totalChunks: session.totalChunks,
    uploadedChunks: [],
    fileLimit: getUserFileLimit(user),
    message: "Chunk upload session ready.",
    storagePath: storagePath,
  });
});

app.get("/api/file-transfers/upload-status/:uploadId", fileListLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
  await cleanupStaleUploadSessions();
  const uploadId = typeof req.params.uploadId === "string" ? req.params.uploadId : "";
  if (!uploadId) {
    res.status(400).json({ error: "Upload session ID is required." });
    return;
  }

  const session = await getActiveUploadSessionById(uploadId, req.auth!.userId);
  if (!session || session.userId !== req.auth!.userId) {
    res.status(404).json({ error: "Upload session not found" });
    return;
  }

  const uploadedChunks = await getUploadedChunkIndices(session);
  const db = await loadDb();
  const transfer = db.fileTransfers.find(
    (entry) => entry.id === session.transferId && entry.userId === req.auth!.userId,
  );
  res.json({
    uploadId: session.id,
    transferId: session.transferId,
    chunkSize: session.chunkSize,
    totalChunks: session.totalChunks,
    uploadedChunks,
    processing: Boolean(session.isCompleting),
    transferStatus: transfer?.transferStatus || "in_progress",
  });
});

app.delete("/api/file-transfers/upload-session/:uploadId", uploadLimiter, requireAuth, requireCsrf, async (req: AuthenticatedRequest, res) => {
  await cleanupStaleUploadSessions();
  const uploadId = typeof req.params.uploadId === "string" ? req.params.uploadId : "";
  if (!uploadId) {
    res.status(400).json({ error: "Upload session ID is required." });
    return;
  }

  const session = await getActiveUploadSessionById(uploadId, req.auth!.userId);
  if (!session || session.userId !== req.auth!.userId) {
    res.status(404).json({ error: "Upload session not found" });
    return;
  }

  const db = await loadDb();
  const transfer = db.fileTransfers.find(
    (entry) => entry.id === session.transferId && entry.userId === req.auth!.userId,
  );
  if (transfer && transfer.transferStatus === "in_progress") {
    transfer.transferStatus = "cancelled";
    transfer.completedAt = nowIso();
    await saveDb(db);
  }

  await cleanupUploadSession(session);
  res.status(204).send();
});

app.post("/api/file-transfers/chunk", uploadLimiter, requireAuth, requireCsrf, async (req: AuthenticatedRequest, res) => {
  await cleanupStaleUploadSessions();
  const parsed = parseUploadChunkHeaders(req.headers);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid upload chunk metadata" });
    return;
  }

  const session = await getActiveUploadSessionById(parsed.data["x-upload-id"], req.auth!.userId);
  if (!session || session.userId !== req.auth!.userId) {
    res.status(404).json({ error: "Upload session not found" });
    return;
  }

  if (parsed.data["x-total-chunks"] !== session.totalChunks) {
    res.status(400).json({ error: "Upload chunk count does not match the upload session." });
    return;
  }

  const chunkIndex = parsed.data["x-chunk-index"];
  if (chunkIndex >= session.totalChunks) {
    res.status(400).json({ error: "Upload chunk index is out of range." });
    return;
  }

  const expectedChunkSize =
    chunkIndex === session.totalChunks - 1
      ? session.fileSize - session.chunkSize * (session.totalChunks - 1)
      : session.chunkSize;

  const existingChunkIndices = await getUploadedChunkIndices(session);
  if (existingChunkIndices.includes(chunkIndex)) {
    session.updatedAt = nowIso();
    const db = await loadDb();
    const transfer = db.fileTransfers.find(
      (entry) => entry.id === session.transferId && entry.userId === req.auth!.userId,
    );
    if (transfer) {
      transfer.uploadSessionId = session.id;
      transfer.uploadTempDir = session.tempDir;
      transfer.uploadChunkSize = session.chunkSize;
      transfer.uploadTotalChunks = session.totalChunks;
      transfer.uploadUpdatedAt = session.updatedAt;
      if (!transfer.storageMode) {
        transfer.storageMode = "chunked";
      }
      await saveDb(db);
    }
    res.status(200).json({
      uploadId: session.id,
      chunkIndex,
      bytesWritten: expectedChunkSize,
      alreadyUploaded: true,
    });
    return;
  }

  session.updatedAt = nowIso();
  const chunkPath = getUploadChunkPath(session, chunkIndex);
  let bytesWritten = 0;

  try {
    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(chunkPath);
      let settled = false;

      const rejectOnce = (error: Error) => {
        if (settled) return;
        settled = true;
        output.destroy(error);
        reject(error);
      };

      req.on("data", (chunk: Buffer) => {
        bytesWritten += chunk.length;
        if (bytesWritten > expectedChunkSize) {
          rejectOnce(new Error("Uploaded chunk exceeded the expected size."));
        }
      });

      req.on("aborted", () => rejectOnce(new Error("Upload chunk was interrupted before completion.")));
      req.on("error", (error) => rejectOnce(error));
      output.on("error", (error) => rejectOnce(error));
      output.on("finish", () => {
        if (settled) return;
        settled = true;
        resolve();
      });
      req.pipe(output);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chunk upload failed";
    res.status(400).json({ error: message });
    return;
  }

  if (bytesWritten !== expectedChunkSize) {
    await rm(chunkPath, { force: true }).catch(() => undefined);
    res.status(400).json({ error: "Uploaded chunk size did not match the expected size." });
    return;
  }

  try {
    const chunkBuffer = await readFile(chunkPath);
    const storageChunkPath = getChunkStoragePath(session.storagePath, chunkIndex);
    const { error: chunkUploadError } = await supabase.storage
      .from(FILE_BUCKET)
      .upload(storageChunkPath, chunkBuffer, {
        contentType: "application/octet-stream",
        upsert: false,
      });

    if (chunkUploadError) {
      throw new Error(`Failed to store uploaded chunk: ${chunkUploadError.message}`);
    }
  } catch (error) {
    await rm(chunkPath, { force: true }).catch(() => undefined);
    const message = error instanceof Error ? error.message : "Chunk upload failed";
    res.status(500).json({ error: message });
    return;
  }

  await rm(chunkPath, { force: true }).catch(() => undefined);

  session.uploadedChunks.add(chunkIndex);
  session.updatedAt = nowIso();
  {
    const db = await loadDb();
    const transfer = db.fileTransfers.find(
      (entry) => entry.id === session.transferId && entry.userId === req.auth!.userId,
    );
    if (transfer) {
      transfer.uploadSessionId = session.id;
      transfer.uploadTempDir = session.tempDir;
      transfer.uploadChunkSize = session.chunkSize;
      transfer.uploadTotalChunks = session.totalChunks;
      transfer.uploadUploadedChunks = Array.from(session.uploadedChunks).sort((a, b) => a - b);
      transfer.uploadUpdatedAt = session.updatedAt;
      if (!transfer.storageMode) {
        transfer.storageMode = "chunked";
      }
      await saveDb(db);
    }
  }
  res.status(201).json({
    uploadId: session.id,
    chunkIndex,
    bytesWritten,
  });
});

app.post("/api/file-transfers/complete-upload", uploadLimiter, requireAuth, requireCsrf, async (req: AuthenticatedRequest, res) => {
  await cleanupStaleUploadSessions();
  const uploadId = typeof req.body?.uploadId === "string" ? req.body.uploadId : "";
  if (!uploadId) {
    res.status(400).json({ error: "Upload session ID is required." });
    return;
  }

  const session = await getActiveUploadSessionById(uploadId, req.auth!.userId);
  if (!session || session.userId !== req.auth!.userId) {
    res.status(404).json({ error: "Upload session not found" });
    return;
  }

  const db = await loadDb();
  const existingTransfer = db.fileTransfers.find(
    (entry) => entry.id === session.transferId && entry.userId === req.auth!.userId,
  );

  if (existingTransfer?.transferStatus === "completed") {
    res.status(200).json(existingTransfer);
    return;
  }

  if (session.isCompleting) {
    res.status(202).json({
      transferId: session.transferId,
      transfer_status: "in_progress",
      processing: true,
    });
    return;
  }

  const finalizeUpload = async () => {
    session.isCompleting = true;
    session.updatedAt = nowIso();

    try {
      if (!session.isDirectUpload) {
        const uploadedChunkIndices = await getUploadedChunkIndices(session);
        if (uploadedChunkIndices.length !== session.totalChunks) {
          throw new Error("Upload is still missing one or more chunks.");
        }

        const scanResult = await scanUploadedPayload(
          session.fileName,
          sanitizeMimeType(session.fileType),
          session.fileSize,
        );
        if (!scanResult.clean) {
          throw new Error("The uploaded file failed security scanning.");
        }

        const currentDb = await loadDb();
        const currentTransfer = currentDb.fileTransfers.find(
          (entry) => entry.id === session.transferId && entry.userId === req.auth!.userId,
        );

        const transfer = currentTransfer || ({
          id: session.transferId,
          userId: req.auth!.userId,
          senderDeviceId: session.senderDeviceId,
          receiverDeviceId: session.receiverDeviceId,
          fileName: session.fileName,
          fileSize: session.fileSize,
          fileType: session.fileType,
          transferStatus: "in_progress",
          transferMethod: session.transferMethod,
          createdAt: session.createdAt,
          filePath: session.storagePath,
        } as FileTransferRecord);
        transfer.transferStatus = "completed";
        transfer.completedAt = nowIso();
        transfer.filePath = session.storagePath;
        transfer.storageMode = "chunked";
        transfer.uploadSessionId = session.id;
        transfer.uploadTempDir = session.tempDir;
        transfer.uploadChunkSize = session.chunkSize;
        transfer.uploadTotalChunks = session.totalChunks;
        transfer.uploadUploadedChunks = uploadedChunkIndices;
        transfer.uploadUpdatedAt = nowIso();

        currentDb.fileTransfers = [
          transfer,
          ...currentDb.fileTransfers.filter((entry) => entry.id !== transfer.id),
        ];
        await saveDb(currentDb);
        await cleanupUploadSession(session);
        return transfer;
      }

      const currentDb = await loadDb();
      const currentTransfer = currentDb.fileTransfers.find(
        (entry) => entry.id === session.transferId && entry.userId === req.auth!.userId,
      );

      const transfer = currentTransfer || ({
        id: session.transferId,
        userId: req.auth!.userId,
        senderDeviceId: session.senderDeviceId,
        receiverDeviceId: session.receiverDeviceId,
        fileName: session.fileName,
        fileSize: session.fileSize,
        fileType: session.fileType,
        transferStatus: "in_progress",
        transferMethod: session.transferMethod,
        createdAt: session.createdAt,
        filePath: session.storagePath,
      } as FileTransferRecord);

      transfer.transferStatus = "completed";
      transfer.completedAt = nowIso();
      transfer.filePath = session.storagePath;
      transfer.fileName = session.fileName;
      transfer.fileSize = session.fileSize;
      transfer.fileType = session.fileType;
      transfer.senderDeviceId = session.senderDeviceId;
      transfer.receiverDeviceId = session.receiverDeviceId;
      transfer.transferMethod = session.transferMethod;

      currentDb.fileTransfers = [
        transfer,
        ...currentDb.fileTransfers.filter((entry) => entry.id !== transfer.id),
      ];
      await saveDb(currentDb);
      await cleanupUploadSession(session);
      return transfer;
    } catch (error) {
      session.isCompleting = false;
      console.error("Complete upload error:", error);
      const currentDb = await loadDb();
      const failedTransfer = currentDb.fileTransfers.find(
        (entry) => entry.id === session.transferId && entry.userId === req.auth!.userId,
      );
      if (failedTransfer && failedTransfer.transferStatus === "in_progress") {
        failedTransfer.transferStatus = "failed";
        failedTransfer.completedAt = nowIso();
        await saveDb(currentDb);
      }
      throw error;
    }
  };

  if (session.fileSize <= SYNC_COMPLETE_UPLOAD_LIMIT_BYTES) {
    try {
      const completedTransfer = await finalizeUpload();
      res.status(200).json(completedTransfer);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to complete upload.";
      res.status(500).json({ error: message });
    }
    return;
  }

  res.status(202).json({
    transferId: session.transferId,
    transfer_status: "in_progress",
    processing: true,
  });

  void finalizeUpload().catch(() => undefined);
});

app.post("/api/auth/logout", requireAuth, async (req: AuthenticatedRequest, res) => {
  await revokeToken(req.auth!.jti, "logout");
  clearAuthCookies(res);
  res.status(204).send();
});

app.post("/api/file-transfers/upload", uploadLimiter, requireAuth, requireCsrf, async (req: AuthenticatedRequest, res) => {
  const parsedHeaders = parseUploadHeaders(req.headers);
  if (!parsedHeaders.success) {
    res.status(400).json({ error: "Invalid upload metadata" });
    return;
  }

  const db = await loadDb();
  const user = db.users.find((entry) => entry.id === req.auth!.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (refreshUserPlan(user)) {
    await saveDb(db);
  }

  const sanitizedFileName = sanitizeStoredFileName(parsedHeaders.data["x-file-name"]);
  const sanitizedFileType = sanitizeMimeType(parsedHeaders.data["x-file-type"]);
  const uploadConstraintError = assertUploadConstraints(
    db,
    user,
    sanitizedFileName,
    parsedHeaders.data["x-file-size"],
    sanitizedFileType,
  );
  if (uploadConstraintError) {
    res.status(uploadConstraintError.status).json({
      error: uploadConstraintError.error,
      fileLimit: getUserFileLimit(user),
      plan: isSubscriptionActive(user) ? "pro" : "free",
    });
    return;
  }

  const transferId = createId();
  const storagePath = createStorageObjectPath(req.auth!.userId, sanitizedFileName);

  // Buffer the request body into memory, enforcing the size limit.
  // Using Writable (not Transform) avoids backpressure from an unconsumed readable side.
  let bytesWritten = 0;
  const chunks: Buffer[] = [];

  try {
    await new Promise<void>((resolve, reject) => {
      const sink = new Writable({
        write(chunk: Buffer, _enc, cb) {
          bytesWritten += chunk.length;
          if (bytesWritten > MAX_SINGLE_FILE_SIZE) {
            cb(new Error(`File exceeds the ${formatLimitLabel(MAX_SINGLE_FILE_SIZE)} upload limit.`));
          } else {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    res.status(400).json({ error: message });
    return;
  }

  if (bytesWritten !== parsedHeaders.data["x-file-size"]) {
    res.status(400).json({ error: "Uploaded file size did not match the declared size." });
    return;
  }

  const fileBuffer = Buffer.concat(chunks);
  const fileValidationError = await validateUploadedFileBuffer(
    fileBuffer,
    sanitizedFileType,
    parsedHeaders.data["x-file-size"],
  );
  if (fileValidationError) {
    res.status(400).json({ error: fileValidationError });
    return;
  }
  const scanResult = await scanUploadedPayload(
    sanitizedFileName,
    sanitizedFileType,
    parsedHeaders.data["x-file-size"],
  );
  if (!scanResult.clean) {
    res.status(400).json({ error: "The uploaded file failed security scanning." });
    return;
  }

  const { error: uploadError } = await supabase.storage
    .from(FILE_BUCKET)
    .upload(ensureRelativeStoragePath(storagePath), fileBuffer, {
      contentType: sanitizedFileType,
      upsert: false,
    });

  if (uploadError) {
    console.error("Supabase Storage upload error:", uploadError);
    res.status(500).json({ error: "Failed to store file. Please try again." });
    return;
  }

  const transfer: FileTransferRecord = {
    id: transferId,
    userId: req.auth!.userId,
    senderDeviceId: parsedHeaders.data["x-sender-device-id"],
    receiverDeviceId: parsedHeaders.data["x-receiver-device-id"],
    fileName: sanitizedFileName,
    fileSize: parsedHeaders.data["x-file-size"],
    fileType: sanitizedFileType,
    transferStatus: "completed",
    transferMethod: parsedHeaders.data["x-transfer-method"] || "cloud",
    createdAt: nowIso(),
    completedAt: nowIso(),
    filePath: storagePath, // Supabase Storage path
    storageMode: "single",
  };

  db.fileTransfers.unshift(transfer);
  await saveDb(db);
  res.status(201).json(transfer);
});

app.post("/api/file-transfers", uploadLimiter, requireAuth, requireCsrf, async (req: AuthenticatedRequest, res) => {
  const parsed = fileTransferSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid file transfer payload" });
    return;
  }

  const db = await loadDb();
  const user = db.users.find((entry) => entry.id === req.auth!.userId);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (refreshUserPlan(user)) {
    await saveDb(db);
  }

  const sanitizedFileName = sanitizeStoredFileName(parsed.data.fileName);
  const sanitizedFileType = sanitizeMimeType(parsed.data.fileType);
  const uploadConstraintError = assertUploadConstraints(
    db,
    user,
    sanitizedFileName,
    parsed.data.fileSize,
    sanitizedFileType,
  );
  if (uploadConstraintError) {
    res.status(uploadConstraintError.status).json({
      error: uploadConstraintError.error,
      fileLimit: getUserFileLimit(user),
      plan: isSubscriptionActive(user) ? "pro" : "free",
    });
    return;
  }

  const base64Data = typeof req.body.fileData === "string" ? req.body.fileData : "";
  if (base64Data) {
    const transferId = createId();
    const storagePath = createStorageObjectPath(req.auth!.userId, sanitizedFileName);
    const buffer = Buffer.from(base64Data, "base64");
    const fileValidationError = await validateUploadedFileBuffer(
      buffer,
      sanitizedFileType,
      parsed.data.fileSize,
    );
    if (fileValidationError) {
      res.status(400).json({ error: fileValidationError });
      return;
    }
    const scanResult = await scanUploadedPayload(
      sanitizedFileName,
      sanitizedFileType,
      parsed.data.fileSize,
    );
    if (!scanResult.clean) {
      res.status(400).json({ error: "The uploaded file failed security scanning." });
      return;
    }

    const { error: uploadError } = await supabase.storage
      .from(FILE_BUCKET)
      .upload(ensureRelativeStoragePath(storagePath), buffer, {
        contentType: sanitizedFileType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase Storage upload error (base64 path):", uploadError);
      res.status(500).json({ error: "Failed to store file. Please try again." });
      return;
    }

    const transfer: FileTransferRecord = {
      id: transferId,
      userId: req.auth!.userId,
      senderDeviceId: parsed.data.senderDeviceId,
      receiverDeviceId: parsed.data.receiverDeviceId,
      fileName: sanitizedFileName,
      fileSize: parsed.data.fileSize,
      fileType: sanitizedFileType,
      transferStatus: "completed",
      transferMethod: parsed.data.transferMethod,
      createdAt: nowIso(),
      completedAt: nowIso(),
      filePath: storagePath,
      storageMode: "single",
    };

    db.fileTransfers.unshift(transfer);
    await saveDb(db);
    res.status(201).json(transfer);
    return;
  }

  const transfer: FileTransferRecord = {
    id: createId(),
    userId: req.auth!.userId,
    senderDeviceId: parsed.data.senderDeviceId,
    receiverDeviceId: parsed.data.receiverDeviceId,
    fileName: sanitizedFileName,
    fileSize: parsed.data.fileSize,
    fileType: sanitizedFileType,
    transferStatus: "pending",
    transferMethod: parsed.data.transferMethod,
    createdAt: nowIso(),
  };

  db.fileTransfers.unshift(transfer);
  await saveDb(db);
  res.status(201).json(transfer);
});

app.patch("/api/file-transfers/:id", syncLimiter, requireAuth, requireCsrf, async (req: AuthenticatedRequest, res) => {
  const db = await loadDb();
  const transferId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const transfer = getOwnedTransfer(db, req.auth!.userId, transferId);
  if (!transfer) {
    res.status(404).json({ error: "Transfer not found" });
    return;
  }
  if (typeof req.body.transfer_status === "string") {
    transfer.transferStatus = req.body.transfer_status;
    if (req.body.transfer_status === "completed" || req.body.transfer_status === "cancelled") {
      transfer.completedAt = nowIso();
    }
    if (req.body.transfer_status === "cancelled") {
      const activeSession = await getActiveUploadSessionByTransferId(transfer.id, req.auth!.userId);
      await cleanupUploadSession(activeSession);
      await removeStoredTransferArtifacts(transfer);
    }
  }
  await saveDb(db);
  res.json(transfer);
});

const writeResponseBuffer = async (res: Response, buffer: Buffer) => {
  if (res.write(buffer)) {
    return;
  }

  await new Promise<void>((resolve) => {
    res.once("drain", resolve);
  });
};

const streamChunkedTransferDownload = async (
  res: Response,
  transfer: FileTransferRecord,
  action: "download" | "preview" = "download",
) => {
  if (!transfer.filePath || !transfer.uploadTotalChunks) {
    throw new Error("Chunked transfer metadata is incomplete.");
  }

  res.status(200);
  res.setHeader("Content-Type", sanitizeMimeType(transfer.fileType));
  res.setHeader(
    "Content-Disposition",
    `${action === "preview" ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(transfer.fileName)}`,
  );
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Transfer-Mode", "chunked");
  res.setHeader("Content-Length", String(transfer.fileSize));

  for (let chunkIndex = 0; chunkIndex < transfer.uploadTotalChunks; chunkIndex += 1) {
    const chunkPath = getChunkStoragePath(transfer.filePath, chunkIndex);
    const { data, error } = await supabase.storage.from(FILE_BUCKET).download(chunkPath);
    if (error || !data) {
      throw new Error(`Could not read stored chunk ${chunkIndex + 1}.`);
    }

    const chunkBuffer = Buffer.from(await data.arrayBuffer());
    await writeResponseBuffer(res, chunkBuffer);
  }

  res.end();
};

const getTransferDownloadLink = async (
  req: AuthenticatedRequest,
  userId: string,
  transferId: string,
  action: "download" | "preview" = "download",
) => {
  const db = await loadDb();
  const transfer = getOwnedTransfer(db, userId, transferId);
  if (!transfer?.filePath) {
    return { error: "File not found" as const };
  }

  if (transfer.storageMode === "chunked") {
    const previewQuery = action === "preview" ? "?action=preview" : "";
    return {
      transfer,
      signedUrl: `${getAppBaseUrl(req)}/api/file-transfers/${transfer.id}/download${previewQuery}`,
    };
  }

  const { data, error } = await supabase.storage
    .from(FILE_BUCKET)
    .createSignedUrl(ensureRelativeStoragePath(transfer.filePath), 60 * 5, 
      action === "download" ? { download: transfer.fileName } : undefined
    );

  if (error || !data?.signedUrl) {
    console.error("Supabase signed URL error:", error);
    return { error: "Could not generate download link" as const };
  }

  return {
    transfer,
    signedUrl: data.signedUrl,
  };
};

app.get("/api/file-transfers/:id/download-link", fileListLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
  const transferId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const action = req.query.action === "preview" ? "preview" : "download";
  const result = await getTransferDownloadLink(req, req.auth!.userId, transferId, action);
  if ("error" in result) {
    res.status(result.error === "File not found" ? 404 : 500).json({ error: result.error });
    return;
  }

  res.json({
    signedUrl: result.signedUrl,
    fileName: result.transfer.fileName,
  });
});

app.get("/api/file-transfers/:id/download", fileListLimiter, requireAuth, async (req: AuthenticatedRequest, res) => {
  const transferId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const action = req.query.action === "preview" ? "preview" : "download";
  const db = await loadDb();
  const transfer = getOwnedTransfer(db, req.auth!.userId, transferId);
  if (!transfer?.filePath) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  if (transfer.storageMode === "chunked") {
    try {
      await streamChunkedTransferDownload(res, transfer, action);
    } catch (error) {
      console.error("Chunked transfer download error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Could not generate download link" });
      } else {
        res.destroy();
      }
    }
    return;
  }

  const result = await getTransferDownloadLink(req, req.auth!.userId, transferId, action);
  if ("error" in result) {
    res.status(result.error === "File not found" ? 404 : 500).json({ error: result.error });
    return;
  }

  res.redirect(result.signedUrl);
});

app.get("/api/vault", requireAuth, async (req: AuthenticatedRequest, res) => {
  const db = await loadDb();
  res.json(
    db.vault
      .filter((item) => item.userId === req.auth!.userId)
      .map((item) => ({
        ...item,
        encrypted_content: item.encryptedContent,
        item_type: item.itemType,
        created_at: item.createdAt,
        accessed_at: item.accessedAt,
      })),
  );
});

app.post("/api/vault", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = vaultSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid vault payload" });
    return;
  }

  const item: VaultRecord = {
    id: createId(),
    userId: req.auth!.userId,
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

app.delete("/api/vault/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  const db = await loadDb();
  db.vault = db.vault.filter(
    (entry) => !(entry.id === req.params.id && entry.userId === req.auth!.userId),
  );
  await saveDb(db);
  res.status(204).send();
});

app.get("/api/vault/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  const db = await loadDb();
  const item = db.vault.find(
    (entry) => entry.id === req.params.id && entry.userId === req.auth!.userId,
  );
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

const buildSuggestion = (payload: z.infer<typeof aiRequestSchema>): AiSuggestionRecord => {
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

app.get("/api/ai-suggestions", requireAuth, async (req: AuthenticatedRequest, res) => {
  const db = await loadDb();
  res.json(
    db.aiSuggestions
      .filter((item) => item.userId === req.auth!.userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
});

app.post("/api/ai-assistant", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = aiRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid AI assistant request" });
    return;
  }

  const suggestion = buildSuggestion(parsed.data);
  suggestion.userId = req.auth!.userId;

  const db = await loadDb();
  db.aiSuggestions.unshift(suggestion);
  await saveDb(db);
  res.status(201).json(suggestion);
});

app.patch("/api/ai-suggestions/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  const db = await loadDb();
  const suggestion = db.aiSuggestions.find(
    (entry) => entry.id === req.params.id && entry.userId === req.auth!.userId,
  );
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

app.post("/api/ai-suggestions/:id/feedback", requireAuth, async (req: AuthenticatedRequest, res) => {
  const db = await loadDb();
  const suggestion = db.aiSuggestions.find(
    (entry) => entry.id === req.params.id && entry.userId === req.auth!.userId,
  );
  if (!suggestion) {
    res.status(404).json({ error: "Suggestion not found" });
    return;
  }
  suggestion.feedbackScore = Number(req.body.feedback_score ?? 0);
  await saveDb(db);
  res.json(suggestion);
});

app.delete("/api/ai-suggestions/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  const db = await loadDb();
  db.aiSuggestions = db.aiSuggestions.filter(
    (entry) => !(entry.id === req.params.id && entry.userId === req.auth!.userId),
  );
  await saveDb(db);
  res.status(204).send();
});

app.patch("/api/user/preferences", requireAuth, async (req: AuthenticatedRequest, res) => {
  const db = await loadDb();
  const user = db.users.find((entry) => entry.id === req.auth!.userId);
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

app.post("/api/sync/trigger", syncLimiter, requireAuth, requireCsrf, async (req: AuthenticatedRequest, res) => {
  const db = await loadDb();
  const deviceCount = db.devices.filter((device) => device.userId === req.auth!.userId).length;
  const clipboardCount = db.clipboard.filter((item) => item.userId === req.auth!.userId).length;
  res.json({
    message: "Sync completed",
    devices: deviceCount,
    clipboardItems: clipboardCount,
    timestamp: nowIso(),
  });
});

app.get("/api/bluetooth-devices", requireAuth, async (req: AuthenticatedRequest, res) => {
  const db = await loadDb();
  const devices = db.bluetoothDevices
    .filter((item) => item.userId === req.auth!.userId)
    .sort((a, b) => b.lastDiscovered.localeCompare(a.lastDiscovered));
  res.json(devices);
});

app.post("/api/bluetooth-devices", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = bluetoothSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid bluetooth payload" });
    return;
  }
  const db = await loadDb();
  const existing = db.bluetoothDevices.find(
    (item) => item.userId === req.auth!.userId && item.bluetoothMac === parsed.data.bluetooth_mac,
  );
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
  const record: BluetoothDeviceRecord = {
    id: createId(),
    userId: req.auth!.userId,
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

app.patch("/api/bluetooth-devices/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  const db = await loadDb();
  const device = db.bluetoothDevices.find(
    (entry) => entry.id === req.params.id && entry.userId === req.auth!.userId,
  );
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

app.delete("/api/bluetooth-devices/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  const db = await loadDb();
  db.bluetoothDevices = db.bluetoothDevices.filter(
    (entry) => !(entry.id === req.params.id && entry.userId === req.auth!.userId),
  );
  await saveDb(db);
  res.status(204).send();
});

app.delete("/api/file-transfers/:id", syncLimiter, requireAuth, requireCsrf, async (req: AuthenticatedRequest, res) => {
  const db = await loadDb();
  const transferId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const transfer = getOwnedTransfer(db, req.auth!.userId, transferId);
  const activeSession = await getActiveUploadSessionByTransferId(transferId, req.auth!.userId);
  await cleanupUploadSession(activeSession);
  await removeStoredTransferArtifacts(transfer);
  db.fileTransfers = db.fileTransfers.filter(
    (entry) => !(entry.id === transferId && entry.userId === req.auth!.userId),
  );
  await saveDb(db);
  res.status(204).send();
});

// 🔥 REAL-TIME FILE TRANSFER (SESSION BASED)
// Uses Supabase Storage so files survive server restarts on Render.

app.post("/api/send", requireAuth, async (req, res) => {
  const parsed = sessionTransferSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid session transfer payload" });
  }

  try {
    const buffer = Buffer.from(parsed.data.file, "base64");
    const { error } = await supabase.storage
      .from(SESSION_BUCKET)
      .upload(`sessions/${parsed.data.sessionId}`, buffer, {
        contentType: "application/octet-stream",
        upsert: true,
      });

    if (error) {
      console.error("Session upload error:", error);
      return res.status(500).json({ error: "Failed to store session file" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Session send error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/receive/:sessionId", requireAuth, async (req, res) => {
  const parsed = sessionIdSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid session identifier" });
  }

  try {
    const { data, error } = await supabase.storage
      .from(SESSION_BUCKET)
      .download(`sessions/${parsed.data.sessionId}`);

    if (error || !data) {
      return res.status(404).json({ error: "No file yet" });
    }

    const arrayBuffer = await data.arrayBuffer();
    const file = Buffer.from(arrayBuffer).toString("base64");

    // Delete after retrieval (one-time pickup)
    supabase.storage
      .from(SESSION_BUCKET)
      .remove([`sessions/${parsed.data.sessionId}`])
      .catch((err: unknown) => console.error("Session cleanup error:", err));

    res.json({ file });
  } catch (err) {
    console.error("Session receive error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
// Serve the frontend build in production.  The build script copies
// frontend/dist → root dist/ before compiling the backend.
const FRONTEND_DIST = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/i, "$1")),
  "..",
  "..",
  "..",
  "dist",
);

if (isProduction) {
  app.use(express.static(FRONTEND_DIST, { index: "index.html", maxAge: "1d" }));
}

app.use(createErrorHandler());

// SPA fallback — serve index.html for any non-API route so client-side
// routing works when the user refreshes or deep-links.
if (isProduction) {
  app.get("*", (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
}

let server: ReturnType<typeof app.listen> | null = null;

const shutdown = (signal: string) => {
  logger.warn({ signal }, "Graceful shutdown started");
  if (!server) {
    process.exit(0);
    return;
  }

  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("Forcing shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (error) => {
  logger.error({ err: error }, "Unhandled rejection");
  shutdown("unhandledRejection");
});
process.on("uncaughtException", (error) => {
  logger.error({ err: error }, "Uncaught exception");
  shutdown("uncaughtException");
});

ensureDataDirs()
  .then(() => {
    server = app.listen(port, () => {
      logger.info({ port }, "UniLink API listening");
    });
    server.requestTimeout = UPLOAD_REQUEST_TIMEOUT_MS;
    server.headersTimeout = UPLOAD_REQUEST_TIMEOUT_MS + 60_000;
    server.keepAliveTimeout = 65_000;
  })
  .catch((error) => {
    logger.fatal({ err: error }, "Failed to initialize storage");
    process.exit(1);
  });
