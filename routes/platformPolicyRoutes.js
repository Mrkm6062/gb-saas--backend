import express from "express";
import { getPublicPlatformPolicies } from "../controllers/platformPolicyController.js";

const router = express.Router();

router.get("/public", getPublicPlatformPolicies);

export default router;