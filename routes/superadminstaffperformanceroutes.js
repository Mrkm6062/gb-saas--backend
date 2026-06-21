import express from "express";
import { 
  getMyStoresPerformance, 
  getStaffPerformanceById,
  getMyPerformanceDetails,
  updatePerformanceSettings,
  generatePayout,
  getMyPayouts
} from "../controllers/superadminstaffperformancecontroller.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Apply auth middleware to protect these routes
router.use(protect);

// GET current logged-in staff performance & commission summary
router.get("/details", getMyPerformanceDetails);

// GET current logged-in staff performance stores list
router.get("/my-stores", getMyStoresPerformance);

// GET current logged-in staff payout invoices history
router.get("/my-payouts", getMyPayouts);

// POST update performance settings (Superadmin only)
router.post("/settings", updatePerformanceSettings);

// POST generate payout (Superadmin only)
router.post("/payout", generatePayout);

// GET performance of specific staff member by DB ID (Superadmin/HR only)
router.get("/:id", getStaffPerformanceById);

export default router;
