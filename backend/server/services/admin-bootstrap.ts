import { comparePassword, hashPassword } from "../auth.js";
import { appConfig } from "../config.js";
import { nowIso } from "../helpers.js";
import { createId, loadDb, saveDb } from "../storage.js";
import type { UserRecord } from "../types.js";

/**
 * Ensures the explicitly configured operator account exists. The credentials
 * are intentionally environment-only: never commit them or expose them to the
 * browser. Running this on startup also repairs its role/plan if either was
 * accidentally changed in the data store.
 */
export const ensureConfiguredAdmin = async () => {
  if (!appConfig.adminEmail || !appConfig.adminPassword) return;

  const db = await loadDb();
  const email = appConfig.adminEmail.trim().toLowerCase();
  const timestamp = nowIso();
  let user = db.users.find((entry) => entry.email.toLowerCase() === email);
  let changed = false;

  if (!user) {
    user = {
      id: createId(),
      email,
      firstName: "UniLink",
      lastName: "Admin",
      passwordHash: await hashPassword(appConfig.adminPassword),
      role: "admin",
      plan: "pro",
      createdAt: timestamp,
      updatedAt: timestamp,
      preferences: { aiAssistantEnabled: true },
    } satisfies UserRecord;
    db.users.push(user);
    changed = true;
  } else {
    if (user.role !== "admin" || user.plan !== "pro") {
      user.role = "admin";
      user.plan = "pro";
      changed = true;
    }
    if (!(await comparePassword(appConfig.adminPassword, user.passwordHash))) {
      user.passwordHash = await hashPassword(appConfig.adminPassword);
      changed = true;
    }
    if (changed) user.updatedAt = timestamp;
  }

  if (changed) await saveDb(db);
};
