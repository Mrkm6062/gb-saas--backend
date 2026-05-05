import express from "express";
import { getCheckoutSettings, updateCheckoutSettings, getPublicCheckoutSettings } from "../controllers/checkoutController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/public", getPublicCheckoutSettings);
router.get("/", protect, getCheckoutSettings);
router.put("/", protect, updateCheckoutSettings);

export default router;