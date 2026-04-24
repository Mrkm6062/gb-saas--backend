import express from "express";
import { sendOtp, verifyOtp } from "../controllers/authController.js";
import rateLimit from "express-rate-limit";

const router = express.Router();

// Rate limiting for sending OTPs
const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, 
  message: { message: "Too many OTP requests from this IP. Please try again after 5 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for verifying OTPs
const verifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, 
  message: { message: "Too many failed attempts. Please try again after 5 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/send-otp", otpLimiter, sendOtp);
router.post("/verify-otp", verifyLimiter, verifyOtp);

export default router;