import type { NextFunction, Request, Response, RequestHandler } from "express";
import { ZodTypeAny, z } from "zod";
import { logger } from "./logger.js";
import { sanitizeObjectStrings } from "./helpers.js";

export class HttpError extends Error {
  statusCode: number;
  expose: boolean;

  constructor(statusCode: number, message: string, expose = true) {
    super(message);
    this.statusCode = statusCode;
    this.expose = expose;
  }
}

export const asyncHandler =
  <T extends RequestHandler>(handler: T): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);

export const validate =
  <T extends ZodTypeAny>(schema: T, target: "body" | "query" | "params"): RequestHandler =>
  (req, _res, next) => {
    const parsed = schema.safeParse(req[target]);
    if (!parsed.success) {
      next(new HttpError(400, "Invalid request payload"));
      return;
    }
    req[target] = sanitizeObjectStrings(parsed.data) as Request[typeof target];
    next();
  };

export const rejectDisallowedOrigin: RequestHandler = (req, _res, next) => {
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
    } catch {
      next(new HttpError(403, "Cross-origin state mutation blocked"));
      return;
    }
  }

  next();
};

export const createErrorHandler = () =>
  ((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const statusCode =
      err instanceof HttpError
        ? err.statusCode
        : err instanceof SyntaxError
          ? 400
          : 500;

    logger[statusCode >= 500 ? "error" : "warn"](
      {
        err,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      },
      "Request failed",
    );

    const message =
      err instanceof HttpError && err.expose
        ? err.message
        : statusCode === 400
          ? "Invalid request payload"
          : "Something went wrong";

    res.status(statusCode).json({ error: message });
  }) as unknown as RequestHandler;
