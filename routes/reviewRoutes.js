import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createReview,
  getProductReviews,
  checkReviewStatus,
  getStoreReviews,
  updateReviewStatus,
  deleteReview
} from "../controllers/reviewController.js";

const router = express.Router();

// PUBLIC ROUTES (Storefront - relies on global storeResolver)
router.post("/public", createReview);
router.get("/public/:productId", getProductReviews);
router.get("/public/check/:orderId/:productId", checkReviewStatus);

// ADMIN ROUTES (Dashboard)
router.get("/", protect, getStoreReviews);
router.put("/:id/status", protect, updateReviewStatus);
router.delete("/:id", protect, deleteReview);

export default router;