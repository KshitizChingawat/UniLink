import { z } from "zod";
const parseOrigins = (value) => value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
const envSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(8787),
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: z.string().default("30m"),
    JWT_REMEMBER_ME_EXPIRES_IN: z.string().default("7d"),
    UPLOAD_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().max(60).default(15),
    DOWNLOAD_TOKEN_TTL_HOURS: z.coerce.number().int().positive().max(168).default(24),
    MAX_FILE_SIZE_MB: z.coerce.number().int().positive().max(10240).default(100),
    ALLOWED_ORIGINS: z.string().min(1),
    APP_BASE_URL: z.string().url().optional().or(z.literal("")),
    VAULT_SECRET: z.string().min(32),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    ALLOW_OTP_FALLBACK: z.enum(["true", "false"]).default("true"),
    ALLOW_DEMO_GOOGLE_LOGIN: z.enum(["true", "false"]).default("false"),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.string().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().optional(),
});
const envResult = envSchema.safeParse(process.env);
if (!envResult.success) {
    const formatted = envResult.error.issues
        .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
        .join("; ");
    throw new Error(`Environment validation failed: ${formatted}`);
}
const parsed = envResult.data;
const allowedOrigins = parseOrigins(parsed.ALLOWED_ORIGINS);
if (allowedOrigins.length === 0) {
    throw new Error("ALLOWED_ORIGINS must contain at least one origin.");
}
export const appConfig = {
    nodeEnv: parsed.NODE_ENV,
    isProduction: parsed.NODE_ENV === "production",
    port: parsed.PORT,
    supabaseUrl: parsed.SUPABASE_URL,
    supabaseServiceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY,
    jwtSecret: parsed.JWT_SECRET,
    jwtExpiresIn: parsed.JWT_EXPIRES_IN,
    jwtRememberMeExpiresIn: parsed.JWT_REMEMBER_ME_EXPIRES_IN,
    uploadTokenTtlMinutes: parsed.UPLOAD_TOKEN_TTL_MINUTES,
    downloadTokenTtlHours: parsed.DOWNLOAD_TOKEN_TTL_HOURS,
    maxFileSizeBytes: parsed.MAX_FILE_SIZE_MB * 1024 * 1024,
    allowedOrigins,
    appBaseUrl: parsed.APP_BASE_URL || null,
    vaultSecret: parsed.VAULT_SECRET,
    logLevel: parsed.LOG_LEVEL,
    allowOtpFallback: parsed.ALLOW_OTP_FALLBACK === "true",
    allowDemoGoogleLogin: parsed.ALLOW_DEMO_GOOGLE_LOGIN === "true",
    smtp: {
        host: parsed.SMTP_HOST,
        port: parsed.SMTP_PORT,
        user: parsed.SMTP_USER,
        pass: parsed.SMTP_PASS,
        from: parsed.SMTP_FROM,
    },
};
