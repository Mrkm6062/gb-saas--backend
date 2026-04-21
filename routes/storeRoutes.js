import express from "express";
import { createStore, getMyStore, getStoreBySubdomain } from "../controllers/storeController.js";
import { protect } from "../middleware/authMiddleware.js";
import { subdomainMiddleware } from "../middleware/subdomain.js";
import { storeResolver } from "../middleware/storeResolver.js";
import Product from "../models/Product.js";

const router = express.Router();

router.post("/", protect, createStore); // <--- This maps the frontend to the new controller
router.get("/me", protect, getMyStore);

// Tenant API Routes (Placed before /:subdomain to prevent route conflicts)
router.get("/store", subdomainMiddleware, storeResolver, (req, res) => {
  // Return current store details
  const { storeName, logo, banner, theme } = req.store;
  res.json({ name: storeName, logo, banner, theme });
});

router.get("/products", subdomainMiddleware, storeResolver, async (req, res) => {
  // Product Isolation: Ensure no cross-store data leakage by explicitly filtering by storeId
  const products = await Product.find({ storeId: req.store._id });
  res.json(products);
});

router.get("/:subdomain", getStoreBySubdomain);

export default router;
