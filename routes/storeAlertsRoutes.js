import express from "express";
import { getAlertConfig, saveAlertConfig, sendTestMail } from "../controllers/storeAlertsController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/:storeId", protect, getAlertConfig);
router.put("/:storeId", protect, saveAlertConfig);
router.post("/:storeId/test", protect, sendTestMail);

export default router;