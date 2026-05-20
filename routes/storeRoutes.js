import express from "express";
import { createStore, getMyStore, getStoreBySubdomain, updateStore, upgradeStorePlan, getStoreData, restoreStore, deleteStore } from "../controllers/storeController.js";
import { protect } from "../middleware/authMiddleware.js";
import { subdomainMiddleware } from "../middleware/subdomain.js";
import { storeResolver } from "../middleware/storeResolver.js";
import Product from "../models/Product.js";

const router = express.Router();

// --- PUBLIC ROUTES ---
// This is the main endpoint for the storefront to get its data via domain/subdomain.
router.get("/data", storeResolver, getStoreData);

// --- USER-AUTHENTICATED ROUTES (for the admin dashboard) ---
router.post("/", protect, createStore);
router.get("/me", protect, getMyStore);

// --- TENANT-SPECIFIC PUBLIC ROUTES (for storefront widgets/pages) ---
router.get("/tenant/info", subdomainMiddleware, storeResolver, (req, res) => {
  if (!req.store) return res.status(404).json({ message: "Store not found" });
  const { _id, storeName, logo, banner, theme, favicon, websiteTitle, metaDescription, subdomain } = req.store;
  res.json({ _id, name: storeName, logo, banner, theme, favicon, websiteTitle, metaDescription, subdomain });
});

router.get("/tenant/products", subdomainMiddleware, storeResolver, async (req, res) => {
  if (!req.store) return res.status(404).json({ message: "Store not found" });
  // Only return active products for the public storefront
  const products = await Product.find({ storeId: req.store._id, isActive: true });
  res.json(products);
});

// --- DYNAMIC ID-BASED ROUTES (must be after specific string routes) ---
router.put("/:id", protect, updateStore);
router.delete("/:id", protect, deleteStore); // Added soft delete route
router.put("/:id/restore", protect, restoreStore);
router.put("/:id/plan", protect, upgradeStorePlan);

// This MUST be last to avoid hijacking other routes like /me, /data, /tenant, etc.
router.get("/:subdomain", getStoreBySubdomain);

export default router;
