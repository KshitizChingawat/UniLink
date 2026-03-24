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
export const sendRegistrationOtp = async (email, otp) => {
    if (!SMTP_FROM) {
        throw new Error("Email verification is not configured on the server.");
    }
    if (shouldUseMailtrapApi) {
        const match = SMTP_FROM.match(/<([^>]+)>/);
        const fromEmail = (match?.[1] || SMTP_FROM).trim();
        const fromName = match ? SMTP_FROM.replace(match[0], "").trim() || "UniLink" : "UniLink";
        const response = await Promise.race([
            fetch(MAILTRAP_SEND_API, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${SMTP_PASS}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    from: {
                        email: fromEmail,
                        name: fromName,
                    },
                    to: [{ email }],
                    subject: "Your UniLink verification code",
                    text: `Your UniLink verification code is ${otp}. It expires in 10 minutes.`,
                    html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
              <h2 style="margin-bottom: 8px;">Verify your UniLink email</h2>
              <p>Use this one-time code to finish creating your account:</p>
              <div style="display: inline-block; padding: 12px 18px; border-radius: 12px; background: #2563eb; color: white; font-size: 24px; font-weight: 700; letter-spacing: 6px;">
                ${otp}
              </div>
              <p style="margin-top: 16px;">This code expires in 10 minutes.</p>
            </div>
          `,
                    category: "unilink_registration_otp",
                }),
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Mailtrap API timed out. Check your Mailtrap token and sending domain.")), 15000)),
        ]);
        if (!(response instanceof Response)) {
            throw new Error("Mailtrap API request failed.");
        }
        if (!response.ok) {
            const payload = await response.text();
            throw new Error(`Mailtrap API rejected the OTP email: ${payload || response.statusText}`);
        }
        return;
    }
    if (!transporter) {
        throw new Error("Email verification is not configured on the server.");
    }
    await Promise.race([
        transporter.sendMail({
            from: SMTP_FROM,
            to: email,
            subject: "Your UniLink verification code",
            text: `Your UniLink verification code is ${otp}. It expires in 10 minutes.`,
            html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
          <h2 style="margin-bottom: 8px;">Verify your UniLink email</h2>
          <p>Use this one-time code to finish creating your account:</p>
          <div style="display: inline-block; padding: 12px 18px; border-radius: 12px; background: #2563eb; color: white; font-size: 24px; font-weight: 700; letter-spacing: 6px;">
            ${otp}
          </div>
          <p style="margin-top: 16px;">This code expires in 10 minutes.</p>
        </div>
      `,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Email delivery timed out. Check SMTP settings and sender domain.")), 20000)),
    ]);
};
