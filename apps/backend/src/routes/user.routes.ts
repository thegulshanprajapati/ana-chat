import express from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { userController } from "../services/auth.service.js";

const router = express.Router();

router.use(requireAuth);
router.get("/me", userController.me);
router.get("/sessions", userController.getSessions);
router.get("/devices", userController.getDevices);
router.post("/settings", userController.updateSettings);

export default router;
