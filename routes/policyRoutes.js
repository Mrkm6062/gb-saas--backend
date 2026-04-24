import express from "express";
import { getPolicies, createPolicy, updatePolicy, deletePolicy } from "../controllers/policyController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getPolicies);
router.post("/", protect, createPolicy);
router.put("/:id", protect, updatePolicy);
router.delete("/:id", protect, deletePolicy);

export default router;