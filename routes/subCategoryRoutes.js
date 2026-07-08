import express from "express";
import { 
  getSubCategories, createSubCategory, updateSubCategory, 
  deleteSubCategory, getPublicSubCategories 
} from "../controllers/subCategoryController.js";
import { protect } from "../middleware/authMiddleware.js";
import { subdomainMiddleware } from "../middleware/subdomain.js";
import { storeResolver } from "../middleware/storeResolver.js";

const router = express.Router();

router.get("/public", subdomainMiddleware, storeResolver, getPublicSubCategories);
router.get("/", protect, getSubCategories);
router.post("/", protect, createSubCategory);
router.put("/:id", protect, updateSubCategory);
router.delete("/:id", protect, deleteSubCategory);

export default router;
