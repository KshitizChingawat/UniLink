import test from "node:test";
import assert from "node:assert/strict";

// Run with node --import tsx --test backend/tests/account-storage.test.mjs
test("account lookups read fresh credentials and a missing store never becomes an empty login database", async (t) => {
  Object.assign(process.env, {
    NODE_ENV: "test",
    SUPABASE_URL: "https://storage.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "fixture-key",
    JWT_SECRET: "test".repeat(10),
    VAULT_SECRET: "test".repeat(10),
    ALLOWED_ORIGINS: "https://app.invalid",
  });
  let object;
  let writes = 0;
  const urls = new Set();
  t.mock.method(globalThis, "fetch", async (input, init) => {
    const url = new URL(input);
    assert.equal(url.origin, "https://storage.invalid");
    assert.equal(url.pathname, "/storage/v1/object/unilink-db/db.json");
    if (init.method === "POST") {
      object = JSON.parse(init.body.toString());
      writes++;
      return Response.json({ Key: "unilink-db/db.json" });
    }
    assert.equal(init.method, "GET");
    assert.ok(url.searchParams.get("cacheNonce"));
    assert.ok(!urls.has(url.href), "each account read must bypass a previously cached response");
    urls.add(url.href);
    return object
      ? Response.json(object)
      : Response.json({ statusCode: "404", error: "not_found", message: "Object not found" }, { status: 400 });
  });

  const { loadDb, saveDb, getAccountStorageStatus } = await import("../server/storage.ts");
  assert.equal(await getAccountStorageStatus(), "uninitialized");
  await assert.rejects(loadDb(), /object is missing/);
  const signup = await loadDb({ allowCreate: true });
  signup.users.push({ id: "user-1", email: "mobile@unilink.invalid", passwordHash: "first-hash" });
  await saveDb(signup);
  assert.equal(await getAccountStorageStatus(), "connected");
  const beforeChange = await loadDb();
  const changed = await loadDb();
  changed.users[0].passwordHash = "new-hash";
  await saveDb(changed);
  // An overlapping read followed by an unrelated save must retain the new password.
  await saveDb(beforeChange);
  assert.equal((await loadDb()).users[0].passwordHash, "new-hash");

  object = undefined;
  const writesBeforeLoss = writes;
  await assert.rejects(loadDb({ allowCreate: true }), /object is missing/);
  await assert.rejects(saveDb(beforeChange), /object is missing/);
  assert.equal(writes, writesBeforeLoss);
});
