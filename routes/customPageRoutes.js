import express from "express";
import {
  createPage,
  updatePage,
  deletePage,
  softDeletePage,
  publishPage,
  unpublishPage,
  duplicatePage,
  getAllPages,
  getPageById,
  getPageBySlug,
  getHomepage,
  previewPage,
  searchPages,
} from "../controllers/customPageController.js";
import { protect } from "../middleware/authMiddleware.js";
import { subdomainMiddleware } from "../middleware/subdomain.js";
import { storeResolver } from "../middleware/storeResolver.js";

const router = express.Router();

// Private Dashboard Routes (Strictly matches 24-character Hex MongoDB ObjectIDs)
router.get("/page/:id([0-9a-fA-F]{24})", protect, getPageById);

// Public Routes (resolved via storefront custom domain/subdomain)
router.get("/page/:slug", subdomainMiddleware, storeResolver, getPageBySlug);
router.get("/homepage", subdomainMiddleware, storeResolver, getHomepage);

// Other Private Dashboard Routes
router.post("/page", protect, createPage);
router.put("/page/:id", protect, updatePage);
router.delete("/page/:id", protect, deletePage);
router.delete("/page/:id/soft", protect, softDeletePage);
router.post("/page/:id/publish", protect, publishPage);
router.post("/page/:id/unpublish", protect, unpublishPage);
router.post("/page/:id/duplicate", protect, duplicatePage);
router.get("/pages", protect, getAllPages);
router.get("/pages/search", protect, searchPages);
router.get("/page/:id/preview", protect, previewPage);

export default router;
