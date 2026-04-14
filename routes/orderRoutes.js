import express from "express";
import {
  createOrder,
  getOrders,
  updateOrderStatus,
} from "../controllers/orderController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// PUBLIC (storefront checkout)
router.post("/", createOrder);

// DASHBOARD (owner only)
router.get("/", protect, getOrders);
router.put("/:id", protect, updateOrderStatus);

export default router;