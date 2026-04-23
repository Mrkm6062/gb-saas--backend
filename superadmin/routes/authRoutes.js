import express from "express";
import { registerUser, loginUser } from "../controllers/authController.js";
import rateLimit from "express-rate-limit";

const router = express.Router();

// Rate limiting for login (e.g., max 5 attempts per 15 minutes)
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, 
  message: { message: "Too many login attempts from this IP, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for registration (e.g., max 3 accounts per hour)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, 
  message: { message: "Too many accounts created from this IP, please try again after an hour" },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/register", registerLimiter, registerUser);
router.post("/login", loginLimiter, loginUser);

export default router;