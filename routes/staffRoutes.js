import express from "express";
import {
  createStaff,
  getStaffByStore,
  updateStaff,
  deleteStaff,
  loginStaff,
  sendDigitalBillEmail,
} from "../controllers/staffController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public route for staff to log in at Counter Sale POS
router.post("/login", loginStaff);

// Route for sending digital bill via email
router.post("/send-digital-bill", sendDigitalBillEmail);

// Protected routes for store owners to manage staff
router.post("/", protect, createStaff);
router.get("/", protect, getStaffByStore);
router.put("/:id", protect, updateStaff);
router.delete("/:id", protect, deleteStaff);

export default router;
