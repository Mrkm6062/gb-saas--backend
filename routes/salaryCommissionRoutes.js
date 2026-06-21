import express from "express";
import { generatePayout, getMyPayouts, getAllPayouts } from "../controllers/salaryCommissionController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Apply authentication middleware
router.use(protect);

router.post("/payout", generatePayout);
router.get("/my-payouts", getMyPayouts);
router.get("/all", getAllPayouts);

export default router;
