import express from "express";
import {
  getPwaSettings,
  updatePwaSettings,
  getPublicPwaSettings,
  getPublicPwaManifest
} from "../controllers/pwaController.js";
import { protect } from "../middleware/authMiddleware.js";
import { subdomainMiddleware } from "../middleware/subdomain.js";
import { storeResolver } from "../middleware/storeResolver.js";

const router = express.Router();

// Public storefront dynamic manifest retrieval
router.get("/manifest", subdomainMiddleware, storeResolver, getPublicPwaManifest);
router.get("/public", subdomainMiddleware, storeResolver, getPublicPwaSettings);

// Private dashboard management
router.get("/:storeId", protect, getPwaSettings);
router.put("/:storeId", protect, updatePwaSettings);

export default router;
