import express from "express";
const router = express.Router();

router.get("/ping", (_req, res) => {
  res.json({ status: "ok", message: "Backend healthy" });
});

export default router;
