import { logger } from "./logger.js";
import { sanitizeObjectStrings } from "./helpers.js";
export class HttpError extends Error {
    constructor(statusCode, message, expose = true) {
        super(message);
        this.statusCode = statusCode;
        this.expose = expose;
    }
}
export const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
export const validate = (schema, target) => (req, _res, next) => {
    const parsed = schema.safeParse(req[target]);
    if (!parsed.success) {
        next(new HttpError(400, "Invalid request payload"));
        return;
    }
    req[target] = sanitizeObjectStrings(parsed.data);
    next();
};
export const rejectDisallowedOrigin = (req, _res, next) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method.toUpperCase())) {
        next();
        return;
    }
    const origin = req.headers.origin;
    if (!origin) {
        next();
        return;
    }
    const host = req.headers.host;
    const referer = req.headers.referer;
    if (referer && host) {
        try {
            const refererUrl = new URL(referer);
            if (refererUrl.host !== host && refererUrl.origin !== origin) {
                next(new HttpError(403, "Cross-origin state mutation blocked"));
                return;
            }
        }
        catch {
            next(new HttpError(403, "Cross-origin state mutation blocked"));
            return;
        }
    }
    next();
};
export const createErrorHandler = () => ((err, req, res, _next) => {
    const statusCode = err instanceof HttpError
        ? err.statusCode
        : err instanceof SyntaxError
            ? 400
            : 500;
    logger[statusCode >= 500 ? "error" : "warn"]({
        err,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
    }, "Request failed");
    const message = err instanceof HttpError && err.expose
        ? err.message
        : statusCode === 400
            ? "Invalid request payload"
            : "Something went wrong";
    res.status(statusCode).json({ error: message });
});
