import { readFile } from "node:fs/promises";
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

let writeLock: Promise<void> = Promise.resolve();

const normalizeUser = (user: UserRecord): UserRecord => ({
  ...user,
  plan: user.plan === "pro" ? "pro" : "free",
  subscriptionStartedAt: user.subscriptionStartedAt,
  subscriptionExpiresAt: user.subscriptionExpiresAt,
  preferences: {
    aiAssistantEnabled: user.preferences?.aiAssistantEnabled ?? true,
    twoFactorEnabled: user.preferences?.twoFactorEnabled ?? false,
    twoFactorPhone: user.preferences?.twoFactorPhone,
    twoFactorOtpHash: user.preferences?.twoFactorOtpHash,
    twoFactorOtpExpiresAt: user.preferences?.twoFactorOtpExpiresAt,
    twoFactorVerifiedAt: user.preferences?.twoFactorVerifiedAt,
  },
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

// Earlier deployments could accept signups into a host-local journal.
export const ensureDataDirs = async () => {
  const locations = ["../../server/data/db.json", "./data/db.json"];
  for (const location of locations) {
    let raw: string;
    try {
      raw = await readFile(new URL(location, import.meta.url), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    const legacy = JSON.parse(raw) as Partial<AppDatabase>;
    if (!Array.isArray(legacy.users)) throw new Error("Invalid local account journal");
    const db = await loadDb();
    const ids = new Set(db.users.map(user => user.id));
    const emails = new Set(db.users.map(user => user.email.trim().toLowerCase()));
    const missing = legacy.users.filter(user => !ids.has(user.id) && !emails.has(user.email.trim().toLowerCase()));
    if (missing.length) {
      db.users.push(...missing.map(normalizeUser));
      await saveDb(db);
    }
  }
};

export const createId = () => randomUUID();

const readDb = async (): Promise<string | null> => {
  const { data, error } = await supabase.storage
    .from(DB_BUCKET)
    .download(DB_OBJECT_PATH, {}, { cache: "no-store" });
  if (error) {
    if (/^(object not found|the resource was not found)$/i.test(error.message)) return null;
    throw new Error(`Failed to load account storage: ${error.message}`);
  }
  return data.text();
};

const writeDb = async (json: string): Promise<void> => {
  const buffer = Buffer.from(json, "utf8");
  const { error } = await supabase.storage
    .from(DB_BUCKET)
    .upload(DB_OBJECT_PATH, buffer, { contentType: "application/json", cacheControl: "0", upsert: true });
  if (error) throw new Error(`Failed to save database: ${error.message}`);
};

// Each caller edits an isolated snapshot. Apply only its changes under the
// process write lock so unrelated dashboard requests cannot roll back accounts.
const baselines = new WeakMap<AppDatabase, AppDatabase>();
async function currentDatabase(): Promise<AppDatabase> {
  const raw = await readDb();
  if (raw === null) return normalizeDb(null);
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.users)) throw new Error("Invalid account database");
  return normalizeDb(parsed);
}

export const loadDb = async (): Promise<AppDatabase> => {
  await writeLock.catch(() => undefined);
  const base = await currentDatabase();
  const snapshot = structuredClone(base);
  baselines.set(snapshot, base);
  return snapshot;
};

function mergeChanges<T extends { id: string }>(before: T[], edited: T[], latest: T[]): T[] {
  const original = new Map(before.map(row => [row.id, row]));
  const updated = new Map(edited.map(row => [row.id, row]));
  const merged = new Map(latest.map(row => [row.id, row]));
  for (const id of new Set([...original.keys(), ...updated.keys()])) {
    const prior = JSON.stringify(original.get(id));
    const next = updated.get(id);
    if (prior === JSON.stringify(next)) continue;
    if (prior !== JSON.stringify(merged.get(id))) throw new Error("Concurrent update. Please retry.");
    if (next) merged.set(id, structuredClone(next));
    else merged.delete(id);
  }
  return [...merged.values()];
}

export const saveDb = async (db: AppDatabase): Promise<void> => {
  const base = baselines.get(db);
  if (!base) throw new Error("Unknown database snapshot");
  writeLock = writeLock.catch(() => undefined).then(async () => {
    const latest = await currentDatabase();
    const merge = <K extends keyof AppDatabase>(key: K) =>
      mergeChanges<{ id: string }>(base[key], db[key], latest[key]);
    const merged = Object.fromEntries(Object.keys(latest).map(key => [key, merge(key as keyof AppDatabase)])) as unknown as AppDatabase;
    const owners = new Map(latest.users.map(user => [user.email.trim().toLowerCase(), user.id]));
    const priorEmails = new Map(base.users.map(user => [user.id, user.email]));
    for (const user of merged.users) {
      const email = user.email.trim().toLowerCase();
      if (priorEmails.get(user.id) !== user.email &&
          owners.has(email) && owners.get(email) !== user.id) {
        throw new Error("Email already registered");
      }
      owners.set(email, user.id);
    }
    await writeDb(JSON.stringify(merged));
    baselines.set(db, structuredClone(db));
  });
  await writeLock;
};
