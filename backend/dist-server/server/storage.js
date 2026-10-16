import { randomUUID } from "node:crypto";
import { supabase, DB_BUCKET } from "./supabase.js";
import { logger } from "./logger.js";
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
// Serializes read-modify-write critical sections for auth/identity flows
// (OTP issue/verify, signup, password changes, upgrades). Chained writes in
// saveDb alone are NOT enough: a concurrent request can still load a stale
// snapshot between another request's load and save and then clobber it.
// Keep slow external I/O (email sending) OUTSIDE the locked span.
let dbMutex = Promise.resolve();
export const withDbLock = async (fn) => {
    const run = dbMutex.catch(() => undefined).then(fn);
    dbMutex = run.then(() => undefined, () => undefined);
    return run;
};
// Last snapshot successfully written to the remote backend. Used to re-attach
// users created by concurrent requests (read-modify-write races) so one
// signup can never silently drop another. Safe because user records are never
// deleted anywhere in the app — only added or updated in place.
let lastPersistedDb = null;
// IDs of OTP verifications deliberately consumed (signup/reset completed).
// A consumed code must never merge back into the database via the rule below.
const consumedVerificationIds = new Map();
const CONSUMED_ID_RETENTION_MS = 30 * 60 * 1000;
export const isStorageAvailable = () => storageAvailable;
// Call after deleting verifications for a completed signup/password-reset so
// a concurrent save can never resurrect the single-use code.
export const markVerificationsConsumed = (ids) => {
    const now = Date.now();
    for (const id of ids)
        consumedVerificationIds.set(id, now);
};
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
    lastPersistedDb = null;
    consumedVerificationIds.clear();
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
    const normalized = normalizeDb(db);
    memoryCache = normalized;
    // Resolves true only when this snapshot actually reached remote storage.
    // Auth-identity writes (signup, password changes) must check this: a
    // "success" that never persisted becomes a phantom account that vanishes on
    // restart and then 401s at login. Returns false instead of throwing so
    // retryable flows (chunk progress, clipboard sync) can degrade gracefully.
    let persisted = false;
    // Chain writes so they never run in parallel
    writeLock = writeLock
        .catch(() => undefined)
        .then(async () => {
        // Merge inside the serialized section, against the LATEST persisted
        // snapshot: re-attach users added by a concurrent request that read the
        // database before this snapshot was taken. (Deletes of other record
        // types still apply — only users are merged, and users are never
        // deleted — so nothing resurrected here can surprise a delete flow.)
        const snapshot = {
            ...normalized,
            users: [...normalized.users],
            emailVerifications: [...normalized.emailVerifications],
        };
        if (lastPersistedDb) {
            const knownIds = new Set(snapshot.users.map((user) => user.id));
            const knownEmails = new Set(snapshot.users.map((user) => user.email.toLowerCase()));
            for (const user of lastPersistedDb.users) {
                if (!knownIds.has(user.id) && !knownEmails.has(user.email.toLowerCase())) {
                    snapshot.users.push(user);
                }
            }
            // Same race protection for OTP codes: re-attach verifications created
            // concurrently — but NEVER ones the caller deliberately replaced
            // (superseded: same email+purpose present), consumed (single-use), or
            // expired. Otherwise a concurrent signup/reset could wipe a live code.
            const now = Date.now();
            for (const [id, at] of consumedVerificationIds) {
                if (now - at > CONSUMED_ID_RETENTION_MS)
                    consumedVerificationIds.delete(id);
            }
            const callerPurposes = new Set(snapshot.emailVerifications.map((entry) => `${entry.email}::${entry.purpose}`));
            const knownVerificationIds = new Set(snapshot.emailVerifications.map((entry) => entry.id));
            for (const entry of lastPersistedDb.emailVerifications) {
                if (knownVerificationIds.has(entry.id))
                    continue;
                if (callerPurposes.has(`${entry.email}::${entry.purpose}`))
                    continue;
                if (consumedVerificationIds.has(entry.id))
                    continue;
                if (new Date(entry.expiresAt).getTime() <= now)
                    continue;
                snapshot.emailVerifications.push(entry);
            }
            // The merged snapshot is the freshest known state — serve it from memory too.
            memoryCache = snapshot;
        }
        try {
            await writeDb(JSON.stringify(snapshot, null, 2));
            lastPersistedDb = snapshot;
            persisted = true;
        }
        catch (error) {
            logger.error({ error: error instanceof Error ? error.message : String(error) }, "Failed to persist database to Supabase Storage — recent changes are memory-only and will be lost on restart");
        }
    });
    await writeLock;
    return persisted;
};
