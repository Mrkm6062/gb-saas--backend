import express from "express";
import {
  getTrackingSettings,
  updateTrackingSettings,
  getPublicTrackingSettings
} from "../controllers/trackingSettingsController.js";
import { protect } from "../middleware/authMiddleware.js";
import { subdomainMiddleware } from "../middleware/subdomain.js";
import { storeResolver } from "../middleware/storeResolver.js";

const router = express.Router();

// Public storefront tracking retrieval
router.get("/public", subdomainMiddleware, storeResolver, getPublicTrackingSettings);

// Private dashboard management
router.get("/:storeId", protect, getTrackingSettings);
router.put("/:storeId", protect, updateTrackingSettings);

export default router;
