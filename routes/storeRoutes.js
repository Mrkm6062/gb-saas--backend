import express from "express";
import { createStore, getMyStore, getStoreBySubdomain } from "../controllers/storeController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, createStore); // <--- This maps the frontend to the new controller
router.get("/me", protect, getMyStore);
router.get("/:subdomain", getStoreBySubdomain);

export default router;
