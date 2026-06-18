import express from "express";
import { randomBytes } from "crypto";
import { getDb, getNextSequence } from "../db.js";
import { auth } from "../middleware/auth.js";
import { admin as adminOnly } from "../middleware/admin.js";

const router = express.Router();

router.post("/generate", auth, adminOnly, async (_req, res) => {
  const code = randomBytes(4).toString("hex");
  const id = await getNextSequence("invite_codes");
  await getDb().then(db => db.collection("invite_codes").insertOne({
    id,
    code,
    is_used: false,
    enabled: true,
    created_at: new Date()
  }));
  res.json({ code });
});

router.patch("/:id/toggle", auth, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const { enabled } = req.body;
  const db = await getDb();
  await db.collection("invite_codes").updateOne({ id }, { $set: { enabled: Boolean(enabled) } });
  res.json({ ok: true });
});

router.get("/list", auth, adminOnly, async (_req, res) => {
  const db = await getDb();
  const rows = await db.collection("invite_codes").find().sort({ created_at: -1 }).toArray();
  res.json(rows);
});

export default router;
