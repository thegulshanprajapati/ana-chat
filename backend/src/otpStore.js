import bcrypt from "bcryptjs";
import { getDb, getNextSequence } from "./db.js";

export async function createSignupOtpRequest({ mobile, otp, payload }) {
  const otpHash = await bcrypt.hash(otp, 10);
  const db = await getDb();
  await db.collection("otp_requests").insertOne({
    id: await getNextSequence("otp_requests"),
    mobile,
    otp_hash: otpHash,
    purpose: "signup",
    expires_at: new Date(Date.now() + 5 * 60 * 1000),
    created_at: new Date(),
    verified_at: null,
    payload_json: payload ? JSON.stringify(payload) : null
  });
}

export async function validateSignupOtp({ mobile, otp }) {
  const db = await getDb();
  const row = await db.collection("otp_requests").findOne(
    { mobile, purpose: "signup", verified_at: null },
    { sort: { id: -1 } }
  );

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  const ok = await bcrypt.compare(otp, row.otp_hash);
  if (!ok) return null;

  return row;
}

export async function markOtpVerified(otpRequestId) {
  const db = await getDb();
  await db.collection("otp_requests").updateOne(
    { id: Number(otpRequestId) },
    { $set: { verified_at: new Date() } }
  );
}
