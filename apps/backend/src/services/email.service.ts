import nodemailer from "nodemailer";
import { config } from "../config.js";

const transporter = nodemailer.createTransport({
  host: config.smtpHost,
  port: config.smtpPort,
  secure: config.smtpPort === 465,
  auth: {
    user: config.smtpUser,
    pass: config.smtpPass
  }
});

export async function sendEmail(to: string, subject: string, html: string, text?: string) {
  if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
    console.warn("[Email] SMTP is not configured, skipping email send.");
    return;
  }

  await transporter.sendMail({
    from: config.smtpUser,
    to,
    subject,
    html,
    text
  });
}
