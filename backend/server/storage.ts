import { randomUUID } from "node:crypto";
import type { AppDatabase, UserRecord } from "./types.js";
import { supabase, DB_BUCKET } from "./supabase.js";

const DB_OBJECT_PATH = "db.json";

const initialDb: AppDatabase = {
  users: [],
  devices: [],
  clipboard: [],
  fileTransfers: [],
  vault: [],
  aiSuggestions: [],
  bluetoothDevices: [],
  pairSessions: [],
  emailVerifications: [],
};

let dbCache: AppDatabase | null = null;
// Write-lock: queue concurrent saveDb calls so they don't race and corrupt db.json
let writeLock: Promise<void> = Promise.resolve();

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
  emailVerifications: raw?.emailVerifications || [],
});

// no-op: kept so index.ts startup doesn't need to change
export const ensureDataDirs = async () => {};

export const createId = () => randomUUID();

const readDb = async (): Promise<string | null> => {
  const { data, error } = await supabase.storage
    .from(DB_BUCKET)
    .download(DB_OBJECT_PATH);
  if (error) return null;
  return data.text();
};

const writeDb = async (json: string): Promise<void> => {
  const buffer = Buffer.from(json, "utf8");
  const { error } = await supabase.storage
    .from(DB_BUCKET)
    .upload(DB_OBJECT_PATH, buffer, { contentType: "application/json", upsert: true });
  if (error) throw new Error(`Failed to save database: ${error.message}`);
};

export const loadDb = async (): Promise<AppDatabase> => {
  if (dbCache) return dbCache;
  try {
    const raw = await readDb();
    dbCache = normalizeDb(raw ? (JSON.parse(raw) as Partial<AppDatabase>) : null);
  } catch {
    dbCache = { ...initialDb };
    await writeDb(JSON.stringify(dbCache, null, 2));
  }
  return dbCache;
};

export const saveDb = async (db: AppDatabase): Promise<void> => {
  dbCache = db; // update cache immediately so in-flight reads stay consistent
  // Chain writes so they never run in parallel
  writeLock = writeLock
    .catch(() => undefined)
    .then(() => writeDb(JSON.stringify(db, null, 2)));
  await writeLock;
};
