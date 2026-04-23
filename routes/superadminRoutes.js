import express from "express";
import { loginSuperAdmin, getDashboardData } from "../superadmin/controllers/authController.js";

const router = express.Router();

router.post("/login", loginSuperAdmin);
router.get("/data", getDashboardData); // Endpoint to fetch all users and stores

export default router;