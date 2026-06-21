import express from "express";
import { getSeoSettings, updateSeoSettings } from "../controllers/seoaicontroller.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/:storeId", protect, getSeoSettings);
router.put("/:storeId", protect, updateSeoSettings);

export default router;
