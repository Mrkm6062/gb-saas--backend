import express from "express";
import { 
  getOfferCategories, createOfferCategory, updateOfferCategory, 
  deleteOfferCategory, getPublicOfferCategories 
} from "../controllers/offerCategoryController.js";
import { protect } from "../middleware/authMiddleware.js";
import { subdomainMiddleware } from "../middleware/subdomain.js";
import { storeResolver } from "../middleware/storeResolver.js";

const router = express.Router();

router.get("/public", subdomainMiddleware, storeResolver, getPublicOfferCategories);
router.get("/", protect, getOfferCategories);
router.post("/", protect, createOfferCategory);
router.put("/:id", protect, updateOfferCategory);
router.delete("/:id", protect, deleteOfferCategory);

export default router;
