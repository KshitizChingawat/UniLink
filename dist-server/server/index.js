import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { z } from "zod";
import { comparePassword, hashPassword, requireAuth, sanitizeUser, signToken } from "./auth.js";
import { decryptVaultContent, encryptVaultContent } from "./crypto.js";
import { nowIso, safeJoinUploadPath, sanitizeFilename } from "./helpers.js";
import { createId, ensureDataDirs, getUploadDir, loadDb, saveDb } from "./storage.js";
const app = express();
const port = Number(process.env.PORT || 8787);
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 25, standardHeaders: true, legacyHeaders: false });
app.use(helmet({
    crossOriginResourcePolicy: false,
}));
app.use(express.json({ limit: "3mb" }));
app.use(express.urlencoded({ extended: true, limit: "3mb" }));
const registerSchema = z.object({
    email: z.string().trim().email().max(120),
    password: z.string().min(8).max(128),
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
});
const loginSchema = z.object({
    email: z.string().trim().email().max(120),
    password: z.string().min(1).max(128),
    rememberMe: z.boolean().optional(),
});
const deviceSchema = z.object({
    deviceName: z.string().trim().min(1).max(120),
    deviceType: z.enum(["desktop", "mobile", "tablet", "browser"]),
    platform: z.enum(["windows", "macos", "linux", "android", "ios", "browser"]),
    deviceId: z.string().trim().min(1).max(120),
    publicKey: z.string().trim().max(4096).optional(),
});
const fileTransferSchema = z.object({
    fileName: z.string().trim().min(1).max(180),
    fileSize: z.coerce.number().int().nonnegative().max(1024 * 1024 * 1024),
    fileType: z.string().trim().max(120).optional(),
    senderDeviceId: z.string().trim().min(1),
    receiverDeviceId: z.string().trim().optional(),
    transferMethod: z.enum(["cloud", "p2p", "local"]).default("cloud"),
});
const clipboardSchema = z.object({
    device_id: z.string().trim().min(1),
    content: z.string().min(1).max(10000),
    content_type: z.string().trim().max(80).default("text"),
});
const vaultSchema = z.object({
    item_type: z.enum(["clipboard", "file", "note"]),
    encrypted_content: z.string().min(1).max(50000),
    metadata: z.record(z.any()).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
});
const aiRequestSchema = z.object({
    content: z.string().min(1).max(20000),
    type: z.enum(["clipboard_analysis", "file_organization", "device_recommendation", "workflow_automation", "content_categorization"]),
    context: z.record(z.any()).optional(),
});
const bluetoothSchema = z.object({
    bluetooth_mac: z.string().trim().min(1).max(120),
    device_name: z.string().trim().min(1).max(120),
    device_capabilities: z.record(z.any()).default({}),
    signal_strength: z.number().int().min(-120).max(20).optional(),
    pairing_status: z.enum(["discovered", "pairing", "paired", "trusted", "blocked"]).default("discovered"),
});
const userResponse = (user) => sanitizeUser(user);
const findUser = async (userId) => {
    const db = await loadDb();
    return db.users.find((entry) => entry.id === userId) || null;
};
app.get("/api/health", async (_req, res) => {
    const db = await loadDb();
    res.json({
        ok: true,
        users: db.users.length,
        timestamp: nowIso(),
    });
});
app.post("/api/auth/register", authLimiter, async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid registration details" });
        return;
    }
    const db = await loadDb();
    const email = parsed.data.email.toLowerCase();
    if (db.users.some((user) => user.email === email)) {
        res.status(409).json({ error: "Email is already registered" });
        return;
    }
    const timestamp = nowIso();
    const user = {
        id: createId(),
        email,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        passwordHash: await hashPassword(parsed.data.password),
        createdAt: timestamp,
        updatedAt: timestamp,
        preferences: {
            aiAssistantEnabled: true,
        },
    };
    db.users.push(user);
    await saveDb(db);
    res.status(201).json({
        token: signToken(user),
        user: userResponse(user),
    });
});
app.post("/api/auth/login", authLimiter, async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid login request" });
        return;
    }
    const db = await loadDb();
    const email = parsed.data.email.toLowerCase();
    const user = db.users.find((entry) => entry.email === email);
    if (!user || !(await comparePassword(parsed.data.password, user.passwordHash))) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
    }
    res.json({
        token: signToken(user, parsed.data.rememberMe),
        user: userResponse(user),
    });
});
app.get("/api/auth/me", requireAuth, async (req, res) => {
    const user = await findUser(req.auth.userId);
    if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
    }
    res.json({ user: userResponse(user) });
});
app.get("/api/devices", requireAuth, async (req, res) => {
    const db = await loadDb();
    const devices = db.devices
        .filter((device) => device.userId === req.auth.userId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    res.json(devices);
});
app.post("/api/devices", requireAuth, async (req, res) => {
    const parsed = deviceSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid device payload" });
        return;
    }
    const db = await loadDb();
    const timestamp = nowIso();
    const existing = db.devices.find((device) => device.userId === req.auth.userId && device.deviceId === parsed.data.deviceId);
    if (existing) {
        existing.deviceName = parsed.data.deviceName;
        existing.deviceType = parsed.data.deviceType;
        existing.platform = parsed.data.platform;
        existing.publicKey = parsed.data.publicKey;
        existing.lastSeen = timestamp;
        existing.isActive = true;
        existing.updatedAt = timestamp;
        await saveDb(db);
        res.json(existing);
        return;
    }
    const device = {
        id: createId(),
        userId: req.auth.userId,
        deviceName: parsed.data.deviceName,
        deviceType: parsed.data.deviceType,
        platform: parsed.data.platform,
        deviceId: parsed.data.deviceId,
        publicKey: parsed.data.publicKey,
        lastSeen: timestamp,
        isActive: true,
        createdAt: timestamp,
        updatedAt: timestamp,
    };
    db.devices.push(device);
    await saveDb(db);
    res.status(201).json(device);
});
app.patch("/api/devices/:id", requireAuth, async (req, res) => {
    const db = await loadDb();
    const device = db.devices.find((entry) => entry.id === req.params.id && entry.userId === req.auth.userId);
    if (!device) {
        res.status(404).json({ error: "Device not found" });
        return;
    }
    if (typeof req.body.isActive === "boolean") {
        device.isActive = req.body.isActive;
    }
    device.lastSeen = nowIso();
    device.updatedAt = nowIso();
    await saveDb(db);
    res.json(device);
});
app.delete("/api/devices/:id", requireAuth, async (req, res) => {
    const db = await loadDb();
    db.devices = db.devices.filter((entry) => !(entry.id === req.params.id && entry.userId === req.auth.userId));
    await saveDb(db);
    res.status(204).send();
});
app.get("/api/clipboard", requireAuth, async (req, res) => {
    const db = await loadDb();
    res.json(db.clipboard
        .filter((item) => item.userId === req.auth.userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});
app.post("/api/clipboard", requireAuth, async (req, res) => {
    const parsed = clipboardSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid clipboard payload" });
        return;
    }
    const db = await loadDb();
    const devices = db.devices.filter((device) => device.userId === req.auth.userId);
    const item = {
        id: createId(),
        userId: req.auth.userId,
        deviceId: parsed.data.device_id,
        content: parsed.data.content,
        contentType: parsed.data.content_type,
        syncTimestamp: nowIso(),
        syncedToDevices: devices.map((device) => device.id).filter((id) => id !== parsed.data.device_id),
        createdAt: nowIso(),
    };
    db.clipboard.unshift(item);
    db.clipboard = db.clipboard.slice(0, 100);
    await saveDb(db);
    res.status(201).json(item);
});
app.delete("/api/clipboard/:id", requireAuth, async (req, res) => {
    const db = await loadDb();
    db.clipboard = db.clipboard.filter((entry) => !(entry.id === req.params.id && entry.userId === req.auth.userId));
    await saveDb(db);
    res.status(204).send();
});
app.get("/api/file-transfers", requireAuth, async (req, res) => {
    const db = await loadDb();
    res.json(db.fileTransfers
        .filter((transfer) => transfer.userId === req.auth.userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});
app.post("/api/file-transfers", requireAuth, async (req, res) => {
    const parsed = fileTransferSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid file transfer payload" });
        return;
    }
    const base64Data = typeof req.body.fileData === "string" ? req.body.fileData : "";
    let filePath;
    if (base64Data) {
        const userDir = path.join(getUploadDir(), req.auth.userId);
        await mkdir(userDir, { recursive: true });
        const transferId = createId();
        filePath = safeJoinUploadPath(userDir, `${transferId}-${sanitizeFilename(parsed.data.fileName)}`);
        const buffer = Buffer.from(base64Data, "base64");
        await writeFile(filePath, buffer);
        const transfer = {
            id: transferId,
            userId: req.auth.userId,
            senderDeviceId: parsed.data.senderDeviceId,
            receiverDeviceId: parsed.data.receiverDeviceId,
            fileName: parsed.data.fileName,
            fileSize: parsed.data.fileSize,
            fileType: parsed.data.fileType,
            transferStatus: "completed",
            transferMethod: parsed.data.transferMethod,
            createdAt: nowIso(),
            completedAt: nowIso(),
            filePath,
        };
        const db = await loadDb();
        db.fileTransfers.unshift(transfer);
        await saveDb(db);
        res.status(201).json(transfer);
        return;
    }
    const transfer = {
        id: createId(),
        userId: req.auth.userId,
        senderDeviceId: parsed.data.senderDeviceId,
        receiverDeviceId: parsed.data.receiverDeviceId,
        fileName: parsed.data.fileName,
        fileSize: parsed.data.fileSize,
        fileType: parsed.data.fileType,
        transferStatus: "pending",
        transferMethod: parsed.data.transferMethod,
        createdAt: nowIso(),
    };
    const db = await loadDb();
    db.fileTransfers.unshift(transfer);
    await saveDb(db);
    res.status(201).json(transfer);
});
app.patch("/api/file-transfers/:id", requireAuth, async (req, res) => {
    const db = await loadDb();
    const transfer = db.fileTransfers.find((entry) => entry.id === req.params.id && entry.userId === req.auth.userId);
    if (!transfer) {
        res.status(404).json({ error: "Transfer not found" });
        return;
    }
    if (typeof req.body.transfer_status === "string") {
        transfer.transferStatus = req.body.transfer_status;
        if (req.body.transfer_status === "completed") {
            transfer.completedAt = nowIso();
        }
    }
    await saveDb(db);
    res.json(transfer);
});
app.get("/api/file-transfers/:id/download", requireAuth, async (req, res) => {
    const db = await loadDb();
    const transfer = db.fileTransfers.find((entry) => entry.id === req.params.id && entry.userId === req.auth.userId);
    if (!transfer?.filePath) {
        res.status(404).json({ error: "File not found" });
        return;
    }
    res.download(transfer.filePath, transfer.fileName);
});
app.get("/api/vault", requireAuth, async (req, res) => {
    const db = await loadDb();
    res.json(db.vault
        .filter((item) => item.userId === req.auth.userId)
        .map((item) => ({
        ...item,
        encrypted_content: item.encryptedContent,
        item_type: item.itemType,
        created_at: item.createdAt,
        accessed_at: item.accessedAt,
    })));
});
app.post("/api/vault", requireAuth, async (req, res) => {
    const parsed = vaultSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid vault payload" });
        return;
    }
    const item = {
        id: createId(),
        userId: req.auth.userId,
        itemType: parsed.data.item_type,
        encryptedContent: encryptVaultContent(parsed.data.encrypted_content),
        metadata: parsed.data.metadata,
        tags: parsed.data.tags || [],
        createdAt: nowIso(),
        accessedAt: nowIso(),
    };
    const db = await loadDb();
    db.vault.unshift(item);
    await saveDb(db);
    res.status(201).json(item);
});
app.delete("/api/vault/:id", requireAuth, async (req, res) => {
    const db = await loadDb();
    db.vault = db.vault.filter((entry) => !(entry.id === req.params.id && entry.userId === req.auth.userId));
    await saveDb(db);
    res.status(204).send();
});
app.get("/api/vault/:id", requireAuth, async (req, res) => {
    const db = await loadDb();
    const item = db.vault.find((entry) => entry.id === req.params.id && entry.userId === req.auth.userId);
    if (!item) {
        res.status(404).json({ error: "Vault item not found" });
        return;
    }
    item.accessedAt = nowIso();
    await saveDb(db);
    res.json({
        ...item,
        decrypted_content: decryptVaultContent(item.encryptedContent),
    });
});
const buildSuggestion = (payload) => {
    const base = {
        id: createId(),
        createdAt: nowIso(),
        expiresAt: null,
        used: false,
    };
    if (payload.type === "clipboard_analysis") {
        const content = payload.content;
        const kind = content.startsWith("http") ? "url" : content.includes("@") ? "contact" : "text";
        return {
            ...base,
            userId: "",
            suggestionType: payload.type,
            confidenceScore: 0.83,
            content: {
                kind,
                summary: kind === "url" ? "Save this link for later or send it to another device." : "Pin this item or store it in the secure vault.",
            },
        };
    }
    if (payload.type === "file_organization") {
        const extension = String(payload.context?.extension || "").toLowerCase();
        return {
            ...base,
            userId: "",
            suggestionType: payload.type,
            confidenceScore: 0.78,
            content: {
                folder: ["png", "jpg", "jpeg", "webp"].includes(extension) ? "Images" : "Documents",
                tags: [extension || "file", "shared"],
            },
        };
    }
    return {
        ...base,
        userId: "",
        suggestionType: payload.type,
        confidenceScore: 0.72,
        content: {
            summary: "UniLink recommends prioritizing active devices and archiving stale items.",
        },
    };
};
app.get("/api/ai-suggestions", requireAuth, async (req, res) => {
    const db = await loadDb();
    res.json(db.aiSuggestions
        .filter((item) => item.userId === req.auth.userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});
app.post("/api/ai-assistant", requireAuth, async (req, res) => {
    const parsed = aiRequestSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid AI assistant request" });
        return;
    }
    const suggestion = buildSuggestion(parsed.data);
    suggestion.userId = req.auth.userId;
    const db = await loadDb();
    db.aiSuggestions.unshift(suggestion);
    await saveDb(db);
    res.status(201).json(suggestion);
});
app.patch("/api/ai-suggestions/:id", requireAuth, async (req, res) => {
    const db = await loadDb();
    const suggestion = db.aiSuggestions.find((entry) => entry.id === req.params.id && entry.userId === req.auth.userId);
    if (!suggestion) {
        res.status(404).json({ error: "Suggestion not found" });
        return;
    }
    if (typeof req.body.used === "boolean") {
        suggestion.used = req.body.used;
    }
    if (typeof req.body.feedback_score === "number") {
        suggestion.feedbackScore = req.body.feedback_score;
    }
    if (typeof req.body.used_at === "string") {
        suggestion.usedAt = req.body.used_at;
    }
    await saveDb(db);
    res.json(suggestion);
});
app.post("/api/ai-suggestions/:id/feedback", requireAuth, async (req, res) => {
    const db = await loadDb();
    const suggestion = db.aiSuggestions.find((entry) => entry.id === req.params.id && entry.userId === req.auth.userId);
    if (!suggestion) {
        res.status(404).json({ error: "Suggestion not found" });
        return;
    }
    suggestion.feedbackScore = Number(req.body.feedback_score ?? 0);
    await saveDb(db);
    res.json(suggestion);
});
app.delete("/api/ai-suggestions/:id", requireAuth, async (req, res) => {
    const db = await loadDb();
    db.aiSuggestions = db.aiSuggestions.filter((entry) => !(entry.id === req.params.id && entry.userId === req.auth.userId));
    await saveDb(db);
    res.status(204).send();
});
app.patch("/api/user/preferences", requireAuth, async (req, res) => {
    const db = await loadDb();
    const user = db.users.find((entry) => entry.id === req.auth.userId);
    if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
    }
    if (typeof req.body.ai_assistant_enabled === "boolean") {
        user.preferences.aiAssistantEnabled = req.body.ai_assistant_enabled;
    }
    user.updatedAt = nowIso();
    await saveDb(db);
    res.json({ preferences: user.preferences });
});
app.post("/api/sync/trigger", requireAuth, async (req, res) => {
    const db = await loadDb();
    const deviceCount = db.devices.filter((device) => device.userId === req.auth.userId).length;
    const clipboardCount = db.clipboard.filter((item) => item.userId === req.auth.userId).length;
    res.json({
        message: "Sync completed",
        devices: deviceCount,
        clipboardItems: clipboardCount,
        timestamp: nowIso(),
    });
});
app.get("/api/bluetooth-devices", requireAuth, async (req, res) => {
    const db = await loadDb();
    const devices = db.bluetoothDevices
        .filter((item) => item.userId === req.auth.userId)
        .sort((a, b) => b.lastDiscovered.localeCompare(a.lastDiscovered));
    res.json(devices);
});
app.post("/api/bluetooth-devices", requireAuth, async (req, res) => {
    const parsed = bluetoothSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid bluetooth payload" });
        return;
    }
    const db = await loadDb();
    const existing = db.bluetoothDevices.find((item) => item.userId === req.auth.userId && item.bluetoothMac === parsed.data.bluetooth_mac);
    if (existing) {
        existing.deviceName = parsed.data.device_name;
        existing.deviceCapabilities = parsed.data.device_capabilities;
        existing.signalStrength = parsed.data.signal_strength;
        existing.pairingStatus = parsed.data.pairing_status;
        existing.lastDiscovered = nowIso();
        await saveDb(db);
        res.json(existing);
        return;
    }
    const record = {
        id: createId(),
        userId: req.auth.userId,
        bluetoothMac: parsed.data.bluetooth_mac,
        deviceName: parsed.data.device_name,
        deviceCapabilities: parsed.data.device_capabilities,
        signalStrength: parsed.data.signal_strength,
        pairingStatus: parsed.data.pairing_status,
        lastDiscovered: nowIso(),
        createdAt: nowIso(),
    };
    db.bluetoothDevices.unshift(record);
    await saveDb(db);
    res.status(201).json(record);
});
app.patch("/api/bluetooth-devices/:id", requireAuth, async (req, res) => {
    const db = await loadDb();
    const device = db.bluetoothDevices.find((entry) => entry.id === req.params.id && entry.userId === req.auth.userId);
    if (!device) {
        res.status(404).json({ error: "Bluetooth device not found" });
        return;
    }
    if (typeof req.body.pairing_status === "string") {
        device.pairingStatus = req.body.pairing_status;
    }
    if (typeof req.body.device_id === "string") {
        device.deviceId = req.body.device_id;
    }
    device.lastDiscovered = nowIso();
    await saveDb(db);
    res.json(device);
});
app.delete("/api/bluetooth-devices/:id", requireAuth, async (req, res) => {
    const db = await loadDb();
    db.bluetoothDevices = db.bluetoothDevices.filter((entry) => !(entry.id === req.params.id && entry.userId === req.auth.userId));
    await saveDb(db);
    res.status(204).send();
});
app.delete("/api/file-transfers/:id", requireAuth, async (req, res) => {
    const db = await loadDb();
    const transfer = db.fileTransfers.find((entry) => entry.id === req.params.id && entry.userId === req.auth.userId);
    if (transfer?.filePath) {
        await unlink(transfer.filePath).catch(() => undefined);
    }
    db.fileTransfers = db.fileTransfers.filter((entry) => !(entry.id === req.params.id && entry.userId === req.auth.userId));
    await saveDb(db);
    res.status(204).send();
});
if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res, next) => {
        if (req.path.startsWith("/api/")) {
            next();
            return;
        }
        res.sendFile(path.join(distPath, "index.html"));
    });
}
ensureDataDirs()
    .then(() => {
    app.listen(port, () => {
        console.log(`UniLink API listening on http://localhost:${port}`);
    });
})
    .catch((error) => {
    console.error("Failed to initialize storage", error);
    process.exit(1);
});
