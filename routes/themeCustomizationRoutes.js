import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getThemeCustomization,
  updateThemeCustomization,
  getPublicThemeCustomization,
} from "../controllers/themeCustomizationController.js";

const router = express.Router();

// PUBLIC STOREFRONT ENDPOINT (Relies on global storeResolver in Server.js)
router.get("/public", getPublicThemeCustomization);

// ADMIN DASHBOARD ENDPOINTS
router.get("/", protect, getThemeCustomization);
router.put("/", protect, updateThemeCustomization);

export default router;