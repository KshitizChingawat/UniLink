import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
const dataDir = path.join(process.cwd(), "server", "data");
const dbPath = path.join(dataDir, "db.json");
const uploadDir = path.join(dataDir, "uploads");
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
export const ensureDataDirs = async () => {
    await mkdir(uploadDir, { recursive: true });
};
export const getUploadDir = () => uploadDir;
export const createId = () => randomUUID();
export const loadDb = async () => {
    if (dbCache) {
        return dbCache;
    }
    await ensureDataDirs();
    try {
        const raw = await readFile(dbPath, "utf8");
        dbCache = normalizeDb(JSON.parse(raw));
    }
    catch {
        dbCache = initialDb;
        await saveDb(dbCache);
    }
    return dbCache;
};
export const saveDb = async (db) => {
    dbCache = db;
    await ensureDataDirs();
    await writeFile(dbPath, JSON.stringify(db, null, 2), "utf8");
};
