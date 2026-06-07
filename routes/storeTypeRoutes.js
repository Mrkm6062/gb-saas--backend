import express from "express";
import {
  getStoreTypes,
  getActiveStoreTypes,
  createStoreType,
  updateStoreType,
  deleteStoreType
} from "../controllers/storeTypeController.js";
import { protect } from "../middleware/authMiddleware.js";
import { protectSuperadmin } from "../middleware/superadminMiddleware.js";

const router = express.Router();

router.get("/active", getActiveStoreTypes);

router.get("/", protect, protectSuperadmin, getStoreTypes);
router.post("/", protect, protectSuperadmin, createStoreType);
router.put("/:id", protect, protectSuperadmin, updateStoreType);
router.delete("/:id", protect, protectSuperadmin, deleteStoreType);

export default router;