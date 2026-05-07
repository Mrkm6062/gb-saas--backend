import express from "express";
import { getSettings, updateSettings, getPublicKey, createSubscriptionOrder, verifyPayment } from "../controllers/platformPaymentController.js";
import { protect } from "../middleware/authMiddleware.js";
import { protectSuperadmin } from "../middleware/superadminMiddleware.js";

const router = express.Router();

router.get("/public-key", protect, getPublicKey);
router.post("/create-order", protect, createSubscriptionOrder);
router.post("/verify-payment", protect, verifyPayment);
router.get("/settings", protectSuperadmin, getSettings);
router.put("/settings", protectSuperadmin, updateSettings);

export default router;