import nodemailer from "nodemailer";
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const MAILTRAP_SEND_API = "https://send.api.mailtrap.io/api/send";
const canSendMail = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && SMTP_FROM);
const shouldUseMailtrapApi = Boolean(SMTP_HOST?.includes("mailtrap.io")) &&
    SMTP_USER === "api" &&
    Boolean(SMTP_PASS) &&
    Boolean(SMTP_FROM);
const transporter = canSendMail
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
    })
    : null;
export const isEmailVerificationConfigured = () => Boolean(transporter);
export const sendEmailOtp = async (email, otp, purpose) => {
    if (!SMTP_FROM || !transporter)
        throw new Error("Email delivery is not configured.");
    const action = purpose === "reset" ? "reset your password" : "verify your email";
    const subject = purpose === "reset" ? "Reset your UniLink password" : "Verify your UniLink email";
    const text = `Your code to ${action} is ${otp}. It expires in 10 minutes.`;
    if (shouldUseMailtrapApi) {
        const match = SMTP_FROM.match(/<([^>]+)>/);
        const response = await fetch(MAILTRAP_SEND_API, {
            method: "POST",
            signal: AbortSignal.timeout(15000),
            headers: { Authorization: `Bearer ${SMTP_PASS}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                from: { email: (match?.[1] || SMTP_FROM).trim(), name: "UniLink" },
                to: [{ email }], subject, text,
            }),
        });
        if (!response.ok)
            throw new Error(`Mail delivery failed (HTTP ${response.status})`);
        return;
    }
    await transporter.sendMail({ from: SMTP_FROM, to: email, subject, text });
};
