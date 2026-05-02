import express from "express";
import { addDomain, verifyDomain, getDomains, deleteDomain } from "../controllers/domainController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// All domain management routes are protected
router.post("/", protect, addDomain);
router.post("/:id/verify", protect, verifyDomain);
router.get("/", protect, getDomains);
router.delete("/:id", protect, deleteDomain);

export default router;