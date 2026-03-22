import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AppDatabase, UserRecord } from "./types.js";

const dataDir = path.join(process.cwd(), "server", "data");
const dbPath = path.join(dataDir, "db.json");
const uploadDir = path.join(dataDir, "uploads");

const initialDb: AppDatabase = {
  users: [],
  devices: [],
  clipboard: [],
  fileTransfers: [],
  vault: [],
  aiSuggestions: [],
  bluetoothDevices: [],
  pairSessions: [],
};

let dbCache: AppDatabase | null = null;

const normalizeUser = (user: UserRecord): UserRecord => ({
  ...user,
  plan: user.plan === "pro" ? "pro" : "free",
  subscriptionStartedAt: user.subscriptionStartedAt,
  subscriptionExpiresAt: user.subscriptionExpiresAt,
});

const normalizeDb = (raw: Partial<AppDatabase> | null | undefined): AppDatabase => ({
  ...initialDb,
  ...raw,
  users: (raw?.users || []).map((user) => normalizeUser(user as UserRecord)),
  devices: raw?.devices || [],
  clipboard: raw?.clipboard || [],
  fileTransfers: raw?.fileTransfers || [],
  vault: raw?.vault || [],
  aiSuggestions: raw?.aiSuggestions || [],
  bluetoothDevices: raw?.bluetoothDevices || [],
  pairSessions: raw?.pairSessions || [],
});

export const ensureDataDirs = async () => {
  await mkdir(uploadDir, { recursive: true });
};

export const getUploadDir = () => uploadDir;

export const createId = () => randomUUID();

export const loadDb = async (): Promise<AppDatabase> => {
  if (dbCache) {
    return dbCache;
  }

  await ensureDataDirs();

  try {
    const raw = await readFile(dbPath, "utf8");
    dbCache = normalizeDb(JSON.parse(raw) as Partial<AppDatabase>);
  } catch {
    dbCache = initialDb;
    await saveDb(dbCache);
  }

  return dbCache;
};

export const saveDb = async (db: AppDatabase) => {
  dbCache = db;
  await ensureDataDirs();
  await writeFile(dbPath, JSON.stringify(db, null, 2), "utf8");
};
