import express from "express";
import { getCategories, createCategory, updateCategory, deleteCategory, getPublicCategories, reorderCategories } from "../controllers/categoryController.js";
import { protect } from "../middleware/authMiddleware.js";
import { subdomainMiddleware } from "../middleware/subdomain.js";
import { storeResolver } from "../middleware/storeResolver.js";

const router = express.Router();

router.get("/public", subdomainMiddleware, storeResolver, getPublicCategories);
router.get("/", protect, getCategories);
router.post("/", protect, createCategory);
router.put("/reorder", protect, reorderCategories);
router.put("/:id", protect, updateCategory);
router.delete("/:id", protect, deleteCategory);

export default router;