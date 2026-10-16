import { randomUUID } from "node:crypto";
import { supabase, DB_BUCKET } from "./supabase.js";
const DB_OBJECT_PATH = "db.json";
const initialDb = {
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
let writeLock = Promise.resolve();
// In-memory fallback cache — used when the storage backend (Supabase) is unavailable.
// This ensures data persists between requests during the process lifetime, enabling
// OTP verification and registration to work without external storage.
let memoryCache = null;
let storageAvailable = true;
const normalizeUser = (user) => ({
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
const normalizeDb = (raw) => ({
    ...initialDb,
    ...raw,
    users: (raw?.users || []).map((user) => normalizeUser(user)),
    devices: raw?.devices || [],
    clipboard: raw?.clipboard || [],
    fileTransfers: raw?.fileTransfers || [],
    vault: raw?.vault || [],
    aiSuggestions: raw?.aiSuggestions || [],
    bluetoothDevices: raw?.bluetoothDevices || [],
    pairSessions: raw?.pairSessions || [],
    emailVerifications: raw?.emailVerifications || [],
});
export const ensureDataDirs = async () => { };
export const createId = () => randomUUID();
export const resetMemoryCache = () => {
    memoryCache = null;
    storageAvailable = true;
};
const readDb = async () => {
    const { data, error } = await supabase.storage
        .from(DB_BUCKET)
        .download(DB_OBJECT_PATH);
    if (error)
        return null;
    return data.text();
};
const writeDb = async (json) => {
    const buffer = Buffer.from(json, "utf8");
    const { error } = await supabase.storage
        .from(DB_BUCKET)
        .upload(DB_OBJECT_PATH, buffer, { contentType: "application/json", upsert: true });
    if (error)
        throw new Error(`Failed to save database: ${error.message}`);
};
const sortByCreatedAt = (records) => [...records].sort((left, right) => {
    const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0;
    const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0;
    return leftTime - rightTime;
});
const mergeById = (remote, local) => {
    const merged = new Map();
    for (const record of remote)
        merged.set(record.id, record);
    for (const record of local)
        merged.set(record.id, record);
    return [...merged.values()];
};
const mergeUsers = (remote, local) => {
    const byId = mergeById(remote.map((user) => normalizeUser(user)), local.map((user) => normalizeUser(user)));
    const byEmail = new Map();
    for (const user of byId) {
        byEmail.set(user.email.toLowerCase(), user);
    }
    return sortByCreatedAt([...byEmail.values()]);
};
const mergeDb = (remote, local) => ({
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
export const loadDb = async () => {
    // Return from in-memory cache if available and storage backend is still unreachable
    if (memoryCache && !storageAvailable) {
        return memoryCache;
    }
    try {
        const raw = await readDb();
        storageAvailable = true;
        if (!raw && memoryCache) {
            // Supabase returned nothing (missing db.json, bad key, transient error).
            // readDb swallows failures as null, so without this guard every request
            // would wipe in-process OTPs and fresh signups with an empty database.
            return memoryCache;
        }
        const db = normalizeDb(raw ? JSON.parse(raw) : null);
        memoryCache = db;
        return db;
    }
    catch {
        storageAvailable = false;
        // Fall back to in-memory cache, or create a fresh empty database
        const nextDb = memoryCache ?? { ...initialDb };
        memoryCache = nextDb;
        try {
            await writeDb(JSON.stringify(nextDb, null, 2));
        }
        catch {
            // Storage backend unavailable — fall back to an in-memory database.
            // Writes will be lost on restart, but reads will return a cached state.
        }
        return nextDb;
    }
};
export const saveDb = async (db) => {
    // Always keep in-memory cache in sync
    memoryCache = normalizeDb(db);
    // Chain writes so they never run in parallel
    writeLock = writeLock
        .catch(() => undefined)
        .then(async () => {
        // Persist the caller's normalized snapshot directly. The write lock
        // already serializes mutations, and merging by id here causes deleted
        // records such as file transfers to be resurrected on the next save.
        const normalizedDb = normalizeDb(db);
        try {
            await writeDb(JSON.stringify(normalizedDb, null, 2));
        }
        catch {
            // Storage backend unavailable — silently skip persistence.
        }
    });
    await writeLock;
};
