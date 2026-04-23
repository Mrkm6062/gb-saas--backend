import express from "express";
import { loginSuperAdmin, getDashboardData } from "../superadmin/controllers/authController.js";
import { getPlans, createOrUpdatePlan, assignPlanToStore } from "../controllers/planController.js";
import { protectSuperadmin } from "../middleware/superadminMiddleware.js";

const router = express.Router();

router.post("/login", loginSuperAdmin);

// Protected Superadmin Routes
router.get("/data", protectSuperadmin, getDashboardData); 
router.get("/plans", protectSuperadmin, getPlans);
router.post("/plans", protectSuperadmin, createOrUpdatePlan);
router.put("/store/:id/plan", protectSuperadmin, assignPlanToStore);

export default router;