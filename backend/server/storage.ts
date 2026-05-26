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

const sortByCreatedAt = <T extends { createdAt?: string }>(records: T[]): T[] =>
  [...records].sort((left, right) => {
    const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0;
    const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0;
    return leftTime - rightTime;
  });

const mergeById = <T extends { id: string }>(remote: T[], local: T[]): T[] => {
  const merged = new Map<string, T>();
  for (const record of remote) merged.set(record.id, record);
  for (const record of local) merged.set(record.id, record);
  return [...merged.values()];
};

const mergeUsers = (remote: UserRecord[], local: UserRecord[]): UserRecord[] => {
  const byId = mergeById(
    remote.map((user) => normalizeUser(user)),
    local.map((user) => normalizeUser(user)),
  );
  const byEmail = new Map<string, UserRecord>();

  for (const user of byId) {
    byEmail.set(user.email.toLowerCase(), user);
  }

  return sortByCreatedAt([...byEmail.values()]);
};

const mergeDb = (remote: AppDatabase, local: AppDatabase): AppDatabase => ({
  users: mergeUsers(remote.users, local.users),
  devices: sortByCreatedAt(mergeById(remote.devices, local.devices)),
  clipboard: sortByCreatedAt(mergeById(remote.clipboard, local.clipboard)),
  fileTransfers: sortByCreatedAt(mergeById(remote.fileTransfers, local.fileTransfers)),
  vault: sortByCreatedAt(mergeById(remote.vault, local.vault)),
  aiSuggestions: sortByCreatedAt(mergeById(remote.aiSuggestions, local.aiSuggestions)),
  bluetoothDevices: sortByCreatedAt(mergeById(remote.bluetoothDevices, local.bluetoothDevices)),
  pairSessions: sortByCreatedAt(mergeById(remote.pairSessions, local.pairSessions)),
  emailVerifications: sortByCreatedAt(mergeById(remote.emailVerifications, local.emailVerifications)),
});

export const loadDb = async (): Promise<AppDatabase> => {
  try {
    const raw = await readDb();
    return normalizeDb(raw ? (JSON.parse(raw) as Partial<AppDatabase>) : null);
  } catch {
    const nextDb = { ...initialDb };
    await writeDb(JSON.stringify(nextDb, null, 2));
    return nextDb;
  }
};

export const saveDb = async (db: AppDatabase): Promise<void> => {
  // Chain writes so they never run in parallel
  writeLock = writeLock
    .catch(() => undefined)
    .then(async () => {
      const remoteRaw = await readDb();
      const remoteDb = normalizeDb(remoteRaw ? (JSON.parse(remoteRaw) as Partial<AppDatabase>) : null);
      const mergedDb = mergeDb(remoteDb, normalizeDb(db));
      await writeDb(JSON.stringify(mergedDb, null, 2));
    });
  await writeLock;
};
