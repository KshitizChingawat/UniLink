import path from "node:path";

export const nowIso = () => new Date().toISOString();

export const sanitizeFilename = (name: string) =>
  name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 140) || "file";

export const safeJoinUploadPath = (baseDir: string, fileName: string) =>
  path.join(baseDir, sanitizeFilename(fileName));
