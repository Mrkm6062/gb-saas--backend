import express from "express";
import { createStore, getMyStore, getStoreBySubdomain, updateStore, upgradeStorePlan, getStoreData, restoreStore } from "../controllers/storeController.js";
import { protect } from "../middleware/authMiddleware.js";
import { subdomainMiddleware } from "../middleware/subdomain.js";
import { storeResolver } from "../middleware/storeResolver.js";
import Product from "../models/Product.js";

const router = express.Router();

router.get("/", storeResolver, getStoreData); // Public domain/subdomain resolution
router.post("/", protect, createStore); // <--- This maps the frontend to the new controller
router.get("/me", protect, getMyStore);
router.put("/:id", protect, updateStore); // Maps PUT requests to update store details
router.put("/:id/restore", protect, restoreStore); // Maps PUT requests to restore a soft-deleted store
router.put("/:id/plan", protect, upgradeStorePlan); // Maps PUT requests to upgrade plan

// Tenant API Routes (Using /tenant prefix to avoid conflicts with /:subdomain)
router.get("/tenant/info", subdomainMiddleware, storeResolver, (req, res) => {
  // Return current store details
  const { _id, storeName, logo, banner, theme, favicon, websiteTitle, metaDescription, subdomain } = req.store;
  res.json({ _id, name: storeName, logo, banner, theme, favicon, websiteTitle, metaDescription, subdomain });
});

router.get("/tenant/products", subdomainMiddleware, storeResolver, async (req, res) => {
  // Product Isolation: Ensure no cross-store data leakage by explicitly filtering by storeId
  const products = await Product.find({ storeId: req.store._id });
  res.json(products);
});

router.get("/:subdomain", getStoreBySubdomain);

export default router;
