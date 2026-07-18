import express from "express";
import {
  createMenu,
  updateMenu,
  deleteMenu,
  getMenuById,
  getAllMenus,
  reorderMenu,
  getPublicMenuByName,
} from "../controllers/customMenuController.js";
import { protect } from "../middleware/authMiddleware.js";
import { subdomainMiddleware } from "../middleware/subdomain.js";
import { storeResolver } from "../middleware/storeResolver.js";

const router = express.Router();

// Public Routes (resolved via storefront subdomain/custom domain context)
router.get("/menu/public/:menuName", subdomainMiddleware, storeResolver, getPublicMenuByName);

// Private Routes
router.post("/menu", protect, createMenu);
router.put("/menu/:id", protect, updateMenu);
router.delete("/menu/:id", protect, deleteMenu);
router.get("/menus", protect, getAllMenus);
router.get("/menu/:id", protect, getMenuById);
router.put("/menu/:id/reorder", protect, reorderMenu);

export default router;
