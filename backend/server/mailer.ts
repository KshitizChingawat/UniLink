import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

const canSendMail = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && SMTP_FROM);

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

export const sendRegistrationOtp = async (email: string, otp: string) => {
  if (!transporter || !SMTP_FROM) {
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
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Email delivery timed out. Check SMTP settings and sender domain.")), 20000),
    ),
  ]);
};
