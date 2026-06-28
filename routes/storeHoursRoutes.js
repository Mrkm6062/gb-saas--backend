import express from "express";
import { getStoreHours, updateStoreHours, getPublicStoreStatus } from "../controllers/storeHoursController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/public/status", getPublicStoreStatus);
router.get("/", getStoreHours);
router.put("/", protect, updateStoreHours);

export default router;
