import express from "express";

const router = express.Router();

// DLT/Fast2SMS callback receiver
router.post("/dlt", (req, res) => {
  const secret = process.env.DLT_WEBHOOK_SECRET;
  const provided = req.headers["x-webhook-secret"] || req.query.secret;

  if (secret && provided !== secret) {
    return res.status(401).json({ success: false, message: "Unauthorized webhook" });
  }

  console.log("[DLT WEBHOOK]", JSON.stringify(req.body));
  return res.status(200).json({ success: true });
});

router.get("/dlt", (_req, res) => {
  res.status(200).json({ success: true, message: "DLT webhook endpoint active" });
});

export default router;
