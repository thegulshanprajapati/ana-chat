import express from "express";
import { requireAdmin } from "../middleware/auth.middleware.js";
import { adminController } from "../services/auth.service.js";

const router = express.Router();

router.use(requireAdmin);
router.get("/users", adminController.listUsers);
router.get("/email-templates", adminController.listEmailTemplates);
router.post("/email-templates", adminController.createEmailTemplate);
router.put("/email-templates/:id", adminController.updateEmailTemplate);
router.get("/audit-logs", adminController.getAuditLogs);

export default router;
