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
};
let dbCache = null;
// Write-lock: queue concurrent saveDb calls so they don't race and corrupt db.json
let writeLock = Promise.resolve();
const normalizeUser = (user) => ({
    ...user,
    plan: user.plan === "pro" ? "pro" : "free",
    subscriptionStartedAt: user.subscriptionStartedAt,
    subscriptionExpiresAt: user.subscriptionExpiresAt,
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
});
// no-op: kept so index.ts startup doesn't need to change
export const ensureDataDirs = async () => { };
export const createId = () => randomUUID();
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
export const loadDb = async () => {
    if (dbCache)
        return dbCache;
    try {
        const raw = await readDb();
        dbCache = normalizeDb(raw ? JSON.parse(raw) : null);
    }
    catch {
        dbCache = { ...initialDb };
        await writeDb(JSON.stringify(dbCache, null, 2));
    }
    return dbCache;
};
export const saveDb = async (db) => {
    dbCache = db; // update cache immediately so in-flight reads stay consistent
    // Chain writes so they never run in parallel
    writeLock = writeLock
        .catch(() => undefined)
        .then(() => writeDb(JSON.stringify(db, null, 2)));
    await writeLock;
};
