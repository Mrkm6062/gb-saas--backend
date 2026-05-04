import express from "express";
import { getCustomerNote, saveCustomerNote } from "../controllers/customerController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/notes", protect, getCustomerNote);
router.post("/notes", protect, saveCustomerNote);

export default router;