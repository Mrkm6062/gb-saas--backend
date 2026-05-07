import express from "express";
import { getSettings, updateSettings, getPublicKey, createSubscriptionOrder, verifyPayment } from "../controllers/platformPaymentController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/public-key", protect, getPublicKey);
router.post("/create-order", protect, createSubscriptionOrder);
router.post("/verify-payment", protect, verifyPayment);
router.get("/settings", protect, getSettings);
router.put("/settings", protect, updateSettings);

export default router;