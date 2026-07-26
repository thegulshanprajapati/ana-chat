/**
 * mailer.js — Unified email dispatch service.
 * Supports SMTP via Nodemailer or Resend API.
 * Falls back to console.log in development when SMTP is not configured.
 */
import nodemailer from "nodemailer";
import { query } from "../dbPostgres.js";
import { mockDb } from "../dbPostgres.js";

let _cachedSettings = null;

/**
 * Load email settings from DB (cached per request cycle).
 */
async function getEmailSettings() {
  try {
    const res = await query("SELECT * FROM email_settings ORDER BY id DESC LIMIT 1");
    return res.rows[0] || null;
  } catch {
    // Fallback to mock
    return mockDb.email_settings[0] || null;
  }
}

/**
 * Clear settings cache (call after admin updates email settings).
 */
export function clearMailerCache() {
  _cachedSettings = null;
}

/**
 * Create a Nodemailer transporter from current DB settings.
 */
async function createTransporter() {
  const settings = await getEmailSettings();

  if (!settings || !settings.smtp_host) {
    return null; // No SMTP configured
  }

  const secure = settings.smtp_encryption === "ssl" || Number(settings.smtp_port) === 465;

  return nodemailer.createTransport({
    host: settings.smtp_host,
    port: Number(settings.smtp_port) || 587,
    secure,
    auth: {
      user: settings.smtp_user,
      pass: settings.smtp_pass
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === "production"
    }
  });
}

/**
 * Send an email.
 * @param {object} options - { to, subject, html, text, from, replyTo }
 */
export async function sendEmail({ to, subject, html, text, from, replyTo }) {
  const settings = await getEmailSettings();

  // --- Resend API ---
  if (settings?.provider === "resend" && settings?.resend_api_key) {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.resend_api_key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: from || `${settings.sender_name || "AnaChat"} <${settings.sender_email}>`,
        to: [to],
        subject,
        html,
        text: text || ""
      })
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(`Resend API error: ${err.message || resp.status}`);
    }
    const data = await resp.json();
    console.log("[Mailer] Email sent via Resend. ID:", data.id);
    return { provider: "resend", id: data.id };
  }

  // --- SMTP via Nodemailer ---
  const transporter = await createTransporter();
  if (!transporter) {
    // Development fallback: log to console
    console.log("\n=================================================");
    console.log("[Mailer] [DEV FALLBACK] No SMTP configured.");
    console.log(`[Mailer] TO: ${to}`);
    console.log(`[Mailer] SUBJECT: ${subject}`);
    console.log(`[Mailer] BODY (text): ${text || "(no plain text)"}`);
    console.log("=================================================\n");
    return { provider: "console", id: "dev-" + Date.now() };
  }

  const senderEmail = settings?.sender_email || process.env.SMTP_FROM || "noreply@anachat.com";
  const senderName = settings?.sender_name || "AnaChat";
  const mailOptions = {
    from: from || `"${senderName}" <${senderEmail}>`,
    replyTo: replyTo || settings?.reply_to || undefined,
    to,
    subject,
    html,
    text: text || ""
  };

  const info = await transporter.sendMail(mailOptions);
  console.log("[Mailer] Email sent via SMTP. MessageId:", info.messageId);
  return { provider: "smtp", messageId: info.messageId };
}
