import path from "node:path";
export const nowIso = () => new Date().toISOString();
const CONTROL_CHAR_REGEX = /[\u0000-\u001f\u007f-\u009f]/g;
const TRAVERSAL_REGEX = /(\.\.[/\\])|[/\\]{2,}|^[A-Za-z]:|^\//g;
const HTML_DANGEROUS_CHARS_REGEX = /[<>"'`]/g;
const NULL_BYTE_REGEX = /\0/g;
const ENCODED_TRAVERSAL_REGEX = /%2e%2e|%2f|%5c/gi;
export const sanitizeTextInput = (value, maxLength = 5000) => value
    .replace(NULL_BYTE_REGEX, "")
    .replace(CONTROL_CHAR_REGEX, " ")
    .replace(ENCODED_TRAVERSAL_REGEX, "")
    .replace(HTML_DANGEROUS_CHARS_REGEX, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
export const sanitizeFilename = (name) => {
    const safeName = sanitizeTextInput(name, 140)
        .replace(TRAVERSAL_REGEX, "_")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
    return safeName || "file";
};
export const ensureRelativeStoragePath = (pathValue) => {
    const normalized = pathValue.replace(/\\/g, "/").replace(/^\/+/, "");
    if (normalized.includes("..") ||
        normalized.includes("\0") ||
        normalized.startsWith("/") ||
        /^[a-zA-Z]:/.test(normalized)) {
        throw new Error("Invalid storage path");
    }
    return normalized;
};
export const sanitizeMimeType = (mimeType) => sanitizeTextInput(mimeType || "application/octet-stream", 120).toLowerCase();
export const safeJoinUploadPath = (baseDir, fileName) => path.join(baseDir, sanitizeFilename(fileName));
export const sanitizeObjectStrings = (value) => {
    if (typeof value === "string") {
        return sanitizeTextInput(value);
    }
    if (Array.isArray(value)) {
        return value.map((entry) => sanitizeObjectStrings(entry));
    }
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
            key,
            sanitizeObjectStrings(entry),
        ]));
    }
    return value;
};
export const escapeHtml = (value) => value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
export const containsNullBytes = (buffer) => buffer.includes(0);
export const isZipBombCandidate = (mimeType, compressedBytes, expandedBytesEstimate) => {
    if (!mimeType.includes("zip"))
        return false;
    return expandedBytesEstimate > compressedBytes * 100;
};
// Parse an HTTP `Range: bytes=start-end` header against a known file size.
// Returns the inclusive { start, end } byte range, or null when the header is
// missing/malformed/unsatisfiable (caller should then serve the full body).
export const parseRangeHeader = (rangeHeader, fileSize) => {
    const raw = Array.isArray(rangeHeader) ? rangeHeader[0] : rangeHeader;
    if (!raw || typeof raw !== "string")
        return null;
    const match = raw.trim().match(/^bytes=(\d*)-(\d*)$/);
    if (!match)
        return null;
    const [, startText, endText] = match;
    if (!startText && !endText)
        return null;
    let start;
    let end;
    if (!startText) {
        // Suffix range: last N bytes.
        const suffixLength = Number.parseInt(endText, 10);
        if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0)
            return null;
        if (suffixLength >= fileSize)
            return { start: 0, end: fileSize - 1 };
        start = fileSize - suffixLength;
        end = fileSize - 1;
    }
    else {
        start = Number.parseInt(startText, 10);
        if (!Number.isSafeInteger(start) || start < 0 || start >= fileSize)
            return null;
        end = endText ? Number.parseInt(endText, 10) : fileSize - 1;
        if (!Number.isSafeInteger(end) || end < start)
            return null;
        end = Math.min(end, fileSize - 1);
    }
    return { start, end };
};
// Map an inclusive byte range onto fixed-size chunk indices, slicing each
// overlapping chunk to the exact bytes needed. Lets downloads/previews fetch
// only the chunks a media player actually requests (instant seek/preview).
export const planChunkedByteRange = (start, end, chunkSize) => {
    const plan = [];
    const firstChunk = Math.floor(start / chunkSize);
    const lastChunk = Math.floor(end / chunkSize);
    for (let chunkIndex = firstChunk; chunkIndex <= lastChunk; chunkIndex += 1) {
        const chunkStart = chunkIndex * chunkSize;
        plan.push({
            chunkIndex,
            sliceStart: Math.max(0, start - chunkStart),
            sliceEnd: Math.min(chunkSize - 1, end - chunkStart),
        });
    }
    return plan;
};
