import { randomUUID } from "node:crypto";
import { HttpError } from "./http.js";
import { saveDb } from "./storage.js";
export function smsConfigured() {
    return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID);
}
async function verifyApi(endpoint, fields) {
    if (!smsConfigured())
        throw new HttpError(503, "SMS verification has not been configured for UniLink.");
    const credentials = Buffer.from(process.env.TWILIO_ACCOUNT_SID + ":" + process.env.TWILIO_AUTH_TOKEN).toString("base64");
    const url = "https://verify.twilio.com/v2/Services/" + encodeURIComponent(process.env.TWILIO_VERIFY_SERVICE_SID) + "/" + endpoint;
    const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: "Basic " + credentials },
        body: new URLSearchParams(fields),
        signal: AbortSignal.timeout(15000),
    }).catch(() => { throw new HttpError(503, "SMS verification is temporarily unavailable."); });
    if (response.status === 429)
        throw new HttpError(429, "Too many SMS attempts. Please try again later.");
    if (endpoint === "VerificationCheck" && [400, 404].includes(response.status)) {
        throw new HttpError(400, "The code is incorrect or has expired.");
    }
    if (endpoint === "Verifications" && response.status === 400)
        throw new HttpError(400, "SMS could not be sent to that number. Check the number and country code.");
    if (!response.ok)
        throw new HttpError(503, "SMS verification is temporarily unavailable.");
    return await response.json();
}
export async function startSms(db, user, purpose, number, rememberMe = false) {
    const phone = number.replace(/[\s().-]/g, "");
    if (!/^\+[1-9]\d{7,14}$/.test(phone))
        throw new HttpError(400, "Include the country code, for example +919876543210.");
    if (!smsConfigured())
        throw new HttpError(503, "SMS verification has not been configured for UniLink.");
    const issuedAt = Date.now();
    if (user.smsChallenge && issuedAt - user.smsChallenge.issuedAt < 30000)
        throw new HttpError(429, "Wait 30 seconds before requesting another code.");
    const challenge = { id: randomUUID(), purpose, phone, issuedAt, version: user.sessionVersion ?? 0, rememberMe };
    user.smsChallenge = challenge;
    await saveDb(db);
    const result = await verifyApi("Verifications", { To: phone, Channel: "sms" });
    if (!result.sid || result.status !== "pending" || result.to !== phone)
        throw new HttpError(503, "The SMS provider could not send the code.");
    challenge.verificationSid = result.sid;
    await saveDb(db);
    return { challengeId: challenge.id, maskedPhone: "•••• " + phone.slice(-4) };
}
export async function checkSms(user, purpose, id, otp) {
    const challenge = user.smsChallenge;
    if (!challenge?.verificationSid || challenge.id !== id || challenge.purpose !== purpose ||
        challenge.version !== (user.sessionVersion ?? 0) || Date.now() - challenge.issuedAt >= 600000) {
        throw new HttpError(400, "This verification has expired. Request another code.");
    }
    const result = await verifyApi("VerificationCheck", { VerificationSid: challenge.verificationSid, Code: otp });
    if (result.status !== "approved" || result.to !== challenge.phone || result.sid !== challenge.verificationSid) {
        throw new HttpError(400, "The code is incorrect or has expired.");
    }
    delete user.smsChallenge;
    return challenge;
}
