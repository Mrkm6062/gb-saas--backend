import express from "express";
import {
  createStaff,
  getStaffByStore,
  updateStaff,
  deleteStaff,
  loginStaff,
  sendDigitalBillEmail,
  getPosCatalog,
  protectStaff,
  getStaffOrders,
  updateStaffOrderStatus,
  getKitchenOrders,
  finishKitchenOrder,
  updateKitchenOrderStatus,
  getStoreDeliveryStaff,
} from "../controllers/staffController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public route for staff login (Counter, Kitchen, Delivery, Cashier, Manager)
router.post("/login", loginStaff);

// Public route for Counter POS catalog (products & categories)
router.get("/pos-catalog", getPosCatalog);

// Public route for active delivery staff list
router.get("/delivery-staff", getStoreDeliveryStaff);

// Route for sending digital bill via email
router.post("/send-digital-bill", sendDigitalBillEmail);

// Kitchen Area (KDS) routes
router.get("/kitchen-orders", getKitchenOrders);
router.post("/kitchen-orders/:id/finish", finishKitchenOrder);
router.post("/kitchen-orders/:id/status", updateKitchenOrderStatus);

// Role-based authenticated staff routes (Delivery staff, Kitchen, Counter)
router.get("/orders", protectStaff, getStaffOrders);
router.put("/orders/:id/status", protectStaff, updateStaffOrderStatus);

// Protected routes for store owners to manage staff
router.post("/", protect, createStaff);
router.get("/", protect, getStaffByStore);
router.put("/:id", protect, updateStaff);
router.delete("/:id", protect, deleteStaff);

export default router;
