import express from "express";
import {
  getMyStore,
  getStoreBySubdomain,
} from "../controllers/storeController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/me", protect, getMyStore);
router.get("/:subdomain", getStoreBySubdomain);

export default router;