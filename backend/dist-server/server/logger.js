import pino from "pino";
import { pinoHttp } from "pino-http";
import { appConfig } from "./config.js";
export const logger = pino({
    level: appConfig.logLevel,
    redact: {
        paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "req.body.password",
            "req.body.currentPassword",
            "req.body.newPassword",
            "req.body.confirmPassword",
            "req.body.file",
            "res.headers['set-cookie']",
        ],
        censor: "[REDACTED]",
    },
});
export const httpLogger = pinoHttp({
    logger,
    customLogLevel(_req, res, error) {
        if (error || res.statusCode >= 500)
            return "error";
        if (res.statusCode >= 400)
            return "warn";
        return "info";
    },
    serializers: {
        req(req) {
            return {
                method: req.method,
                url: req.url,
                remoteAddress: req.remoteAddress,
                userAgent: req.headers["user-agent"],
            };
        },
    },
});
