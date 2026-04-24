import express from "express";
import { getPolicies, createPolicy, updatePolicy, deletePolicy, getPublicPolicies } from "../controllers/policyController.js";
import { protect } from "../middleware/authMiddleware.js";
import { subdomainMiddleware } from "../middleware/subdomain.js";
import { storeResolver } from "../middleware/storeResolver.js";

const router = express.Router();

// Public storefront route (protected by subdomain detection)
router.get("/public", subdomainMiddleware, storeResolver, getPublicPolicies);

router.get("/", protect, getPolicies);
router.post("/", protect, createPolicy);
router.put("/:id", protect, updatePolicy);
router.delete("/:id", protect, deletePolicy);

export default router;