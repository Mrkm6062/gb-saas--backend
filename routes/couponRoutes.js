import express from "express";
import {
  createCoupon,
  getCoupons,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
} from "../controllers/couponController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/validate", validateCoupon); // Public route for storefront checkout
router.post("/", protect, createCoupon); // Admin: Create a coupon
router.get("/", protect, getCoupons); // Admin: Get all store coupons
router.put("/:id", protect, updateCoupon); // Admin: Update a coupon
router.delete("/:id", protect, deleteCoupon); // Admin: Delete a coupon

export default router;