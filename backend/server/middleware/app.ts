import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { appConfig } from "../config.js";
import { rejectDisallowedOrigin } from "../http.js";
import { httpLogger, logger } from "../logger.js";

export const rateLimits = {
  global: rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false, message: { error: "Too many requests. Please slow down and try again." } }),
  auth: rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: "Too many authentication attempts. Please try again later." } }),
  token: rateLimit({ windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: "Too many token requests. Please try again later." } }),
  fileList: rateLimit({ windowMs: 60 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { error: "Too many file listing requests. Please try again later." } }),
  sync: rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, message: { error: "Too many sync requests. Please try again later." } }),
  upload: rateLimit({ windowMs: 15 * 60 * 1000, max: 1500, standardHeaders: true, legacyHeaders: false, message: { error: "Too many upload requests. Please wait before uploading again." } }),
};

const isTrustedProductionOrigin = (origin: string) => {
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return hostname.endsWith(".onrender.com") && hostname.includes("unilink");
  } catch {
    return false;
  }
};

const isLocalDevelopmentOrigin = (origin: string) => {
  try {
    const hostname = new URL(origin).hostname;
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
};

export const configureApp = (app: Express) => {
  const { allowedOrigins, isProduction, supabaseUrl } = appConfig;
  const supabaseOrigin = new URL(supabaseUrl).origin;
  const supabaseStorageOrigin = new URL(supabaseUrl.replace(".supabase.co", ".storage.supabase.co")).origin;

  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(httpLogger);
  app.use(cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        (!isProduction && isLocalDevelopmentOrigin(origin)) ||
        (isProduction && isTrustedProductionOrigin(origin))
      ) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-File-Name", "X-File-Size", "X-File-Type", "X-Sender-Device-Id", "X-Receiver-Device-Id", "X-Transfer-Method", "X-Upload-Id", "X-Chunk-Index", "X-Total-Chunks", "X-CSRF-Token"],
    exposedHeaders: ["Content-Disposition"],
    credentials: true,
    optionsSuccessStatus: 204,
  }));
  app.use(rejectDisallowedOrigin);
  app.use(helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: { directives: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"], imgSrc: ["'self'", "data:", "blob:", "https://api.qrserver.com", supabaseOrigin, supabaseStorageOrigin],
      mediaSrc: ["'self'", "blob:", supabaseOrigin, supabaseStorageOrigin], connectSrc: ["'self'", ...allowedOrigins, supabaseOrigin, supabaseStorageOrigin],
      objectSrc: ["'none'"], baseUri: ["'self'"], frameAncestors: ["'none'"], formAction: ["'self'"],
    } },
    hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
  }));
  app.use((_req, res, next) => {
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });
  app.use(rateLimits.global);
  app.get("/admin", (req, res) => {
    logger.warn({ ip: req.ip, userAgent: req.headers["user-agent"] }, "Honeypot route hit");
    res.json({ status: "ok", system: "public", message: "No administrative access exposed." });
  });
  app.use((req, res, next) => {
    if (req.path === "/api/file-transfers/upload" || req.path === "/api/file-transfers/chunk") return next();
    express.json({ limit: "2mb" })(req, res, next);
  });
  app.use((req, res, next) => {
    if (req.path === "/api/file-transfers/upload" || req.path === "/api/file-transfers/chunk") return next();
    express.urlencoded({ extended: true, limit: "2mb" })(req, res, next);
  });
};
