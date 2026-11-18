import express from "express";
import {
  getCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCouponStatus,
  validateCoupon,
} from "../controllers/galicouponcontroller.js";
import { protect } from "../middleware/authMiddleware.js";
import { protectSuperadmin } from "../middleware/superadminMiddleware.js";

const router = express.Router();

// Public / User authenticated validation for checkout & store creation
router.post("/validate", protect, validateCoupon);
router.post("/validate-public", validateCoupon);

// Superadmin Protected CRUD routes
router.get("/", protectSuperadmin, getCoupons);
router.post("/", protectSuperadmin, createCoupon);
router.get("/:id", protectSuperadmin, getCouponById);
router.put("/:id", protectSuperadmin, updateCoupon);
router.delete("/:id", protectSuperadmin, deleteCoupon);
router.patch("/:id/toggle", protectSuperadmin, toggleCouponStatus);

export default router;
