import assert from "node:assert/strict";
import { once } from "node:events";
import { Server } from "node:http";
import test from "node:test";
import bcrypt from "bcryptjs";

test("SMS enrollment, sign-in and removal require the bound challenge", async t => {
  Object.assign(process.env, {
    NODE_ENV: "test", SUPABASE_URL: "https://storage.invalid", SUPABASE_SERVICE_ROLE_KEY: "fixture",
    JWT_SECRET: "test".repeat(10), VAULT_SECRET: "test".repeat(10), ALLOWED_ORIGINS: "https://app.invalid",
    TWILIO_ACCOUNT_SID: "fixture", TWILIO_AUTH_TOKEN: "fixture", TWILIO_VERIFY_SERVICE_SID: "fixture", LOG_LEVEL: "fatal",
  });
  const phone = "+919876543210";
  const email = "test@unilink.invalid";
  const password = "fixture password";
  let store = { users: [{ id: "user", email, passwordHash: await bcrypt.hash(password, 4), preferences: {} }] };
  const realFetch = globalThis.fetch;
  let sends = 0;
  t.mock.method(globalThis, "fetch", async (input, init) => {
    const url = new URL(input);
    if (url.hostname === "verify.twilio.com") {
      const fields = init.body;
      if (url.pathname.endsWith("/Verifications")) {
        assert.equal(fields.get("To"), phone);
        assert.equal(fields.get("Channel"), "sms");
        sends++;
        return Response.json({ sid: "VE" + sends, status: "pending", to: phone });
      }
      assert.equal(fields.get("VerificationSid"), "VE" + sends);
      return Response.json({ sid: "VE" + sends, to: phone, status: fields.get("Code") === "615203" ? "approved" : "pending" });
    }
    assert.equal(url.origin, "https://storage.invalid");
    if (url.pathname === "/rest/v1/revoked_tokens") return Response.json([]);
    assert.equal(url.pathname, "/storage/v1/object/unilink-db/db.json");
    if (init.method === "POST") store = JSON.parse(init.body.toString());
    return Response.json(store);
  });

  const listen = Server.prototype.listen;
  let ready;
  const started = new Promise(resolve => { ready = resolve; });
  t.mock.method(Server.prototype, "listen", function () {
    listen.call(this, 0, "127.0.0.1", () => ready(this));
    return this;
  });
  await import("../server/index.ts");
  const server = await started;
  t.after(async () => {
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  });
  const call = async (route, body, token) => {
    const response = await realFetch("http://127.0.0.1:" + server.address().port + "/api/auth/" + route, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, cookies: response.headers.get("set-cookie"), ...await response.json() };
  };
  const session = await call("login", { email, password });
  assert.ok(session.token);
  const enroll = { currentPassword: password, purpose: "enable", mobileNumber: "+91 98765-43210" };
  const pending = await call("request-2fa-otp", enroll, session.token);
  assert.ok(pending.challengeId);
  assert.equal(pending.maskedPhone, "•••• 3210");
  assert.equal(pending.developmentOtp, undefined);
  assert.equal((await call("request-2fa-otp", enroll, session.token)).status, 429);
  assert.equal(sends, 1);
  const verify = { challengeId: pending.challengeId, otp: "615203" };
  assert.equal((await call("login/verify-otp", verify)).status, 400);
  assert.equal((await call("verify-2fa-otp", { ...verify, otp: "000000" }, session.token)).status, 400);
  const enabled = await call("verify-2fa-otp", verify, session.token);
  assert.equal(enabled.user.twoFactorEnabled, true);
  assert.equal((await call("me", null, session.token)).status, 401);
  assert.equal((await call("me", null, enabled.token)).status, 200);

  const login = await call("login", { email, password, rememberMe: true });
  assert.ok(login.challengeId);
  assert.equal(login.token, undefined);
  assert.equal(login.cookies, null);
  const proof = { challengeId: login.challengeId, otp: "615203" };
  const issuedAt = store.users[0].smsChallenge.issuedAt;
  store.users[0].smsChallenge.issuedAt -= 600001;
  assert.equal((await call("login/verify-otp", proof)).status, 400);
  store.users[0].smsChallenge.issuedAt = issuedAt;
  assert.equal((await call("login/verify-otp", { ...proof, otp: "000000" })).status, 400);
  const signed = await call("login/verify-otp", proof);
  assert.ok(signed.token);
  assert.ok(signed.cookies);
  assert.equal((await call("login/verify-otp", proof)).status, 400);
  assert.equal((await call("me", null, signed.token)).status, 200);
  delete process.env.TWILIO_AUTH_TOKEN;
  assert.equal((await call("login", { email, password })).status, 503);
  process.env.TWILIO_AUTH_TOKEN = "fixture";

  const remove = { purpose: "disable", currentPassword: password, mobileNumber: "+18005551234" };
  assert.equal((await call("request-2fa-otp", { ...remove, currentPassword: "wrong" }, signed.token)).status, 400);
  const confirm = await call("request-2fa-otp", remove, signed.token);
  assert.equal(confirm.maskedPhone, pending.maskedPhone);
  const disabled = await call("verify-2fa-otp", { challengeId: confirm.challengeId, otp: "615203" }, signed.token);
  assert.equal(disabled.user.twoFactorEnabled, false);
  assert.equal((await call("me", null, signed.token)).status, 401);
  assert.ok((await call("login", { email, password })).token);
});
