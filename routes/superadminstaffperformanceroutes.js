import express from "express";
import { getMyStoresPerformance, getStaffPerformanceById } from "../controllers/superadminstaffperformancecontroller.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Apply auth middleware to protect these routes
router.use(protect);

// GET current logged-in staff performance stores list
router.get("/my-stores", getMyStoresPerformance);

// GET performance of specific staff member by DB ID (Superadmin/HR only)
router.get("/:id", getStaffPerformanceById);

export default router;
