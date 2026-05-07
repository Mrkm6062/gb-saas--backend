import express from "express";
import { 
  createDefaultProduct, 
  updateDefaultProduct, 
  deleteDefaultProduct, 
  getAllDefaultProducts 
} from "../controllers/superadminDefaultProductController.js";
import { protect } from "../middleware/authMiddleware.js";
import { protectSuperadmin } from "../middleware/superadminMiddleware.js";

const router = express.Router();

router.route("/")
  .get(protect, protectSuperadmin, getAllDefaultProducts)
  .post(protect, protectSuperadmin, createDefaultProduct);

router.route("/:id")
  .put(protect, protectSuperadmin, updateDefaultProduct)
  .delete(protect, protectSuperadmin, deleteDefaultProduct);

export default router;