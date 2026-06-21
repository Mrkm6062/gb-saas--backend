import express from "express";
import jwt from "jsonwebtoken";
import { getPlans } from "../controllers/planController.js";

const router = express.Router();


// Middleware to restrict access to specific origins for fetching public plans
const checkOriginForPublicPlans = (req, res, next) => {
  const origin = req.headers.origin;

  // 1. Allow requests if there's no origin (e.g., Postman, server-to-server).
  if (!origin) {
    return next();
  }

  // 2. Allow requests if origin matches allowed domains
  const allowedOrigins = [
    'https://galibrand.cloud',
    'https://www.galibrand.cloud'
  ];

  if (allowedOrigins.includes(origin)) {
    return next();
  }

  // 3. Allow localhost/127.0.0.1 for development
  if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
    return next();
  }

  // 4. Allow subdomains of galibrand.cloud or custom ROOT_DOMAIN
  try {
    const originUrl = new URL(origin);
    const hostname = originUrl.hostname;
    
    if (hostname === 'galibrand.cloud' || hostname.endsWith('.galibrand.cloud')) {
      return next();
    }
    
    const rootDomain = process.env.ROOT_DOMAIN;
    if (rootDomain && (hostname === rootDomain || hostname.endsWith(`.${rootDomain}`))) {
      return next();
    }
  } catch (e) {
    // Ignore URL parse errors
  }

  // 5. Allow requests if they have a valid Authorization token
  if (req.headers.authorization?.startsWith("Bearer")) {
    try {
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.JWT_SECRET);
      return next();
    } catch (error) {
      // Token invalid or expired
    }
  }

  return res.status(403).json({ message: "Access from this origin is not permitted." });
};

router.get("/", checkOriginForPublicPlans, getPlans);

export default router;