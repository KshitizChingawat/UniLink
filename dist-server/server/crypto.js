import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
const vaultSecret = process.env.VAULT_SECRET || "dev-vault-secret-change-me";
const key = createHash("sha256").update(vaultSecret).digest();
export const encryptVaultContent = (plainText) => {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString("base64");
};
export const decryptVaultContent = (payload) => {
    const buffer = Buffer.from(payload, "base64");
    const iv = buffer.subarray(0, 12);
    const tag = buffer.subarray(12, 28);
    const encrypted = buffer.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
};
