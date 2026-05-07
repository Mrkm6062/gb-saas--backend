import express from "express";
import { getDefaultProducts, importDefaultProducts } from "../controllers/defaultProductController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getDefaultProducts);
router.post("/import", protect, importDefaultProducts);

export default router;