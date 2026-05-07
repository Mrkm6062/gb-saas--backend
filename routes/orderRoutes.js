import express from "express";
import { createOrder, getOrders, updateOrderStatus, resendOrderEmail, verifyRazorpayPayment } from "../controllers/orderController.js";
import { protect } from "../middleware/authMiddleware.js";
import { subdomainMiddleware } from "../middleware/subdomain.js";

const router = express.Router();

// Public storefront route (protected by subdomain detection)
router.post("/", subdomainMiddleware, createOrder);
router.post("/verify-payment", verifyRazorpayPayment);

// Admin dashboard routes (protected by JWT authentication)
router.get("/", protect, getOrders);
router.put("/:id/status", protect, updateOrderStatus);
router.post("/:id/resend-email", protect, resendOrderEmail);

export default router;
