import express from "express";
import { getPlans } from "../controllers/planController.js";

const router = express.Router();


// Middleware to restrict access to specific origins for fetching public plans
const checkOriginForPublicPlans = (req, res, next) => {
  const allowedOrigins = [
    'https://galibrand.cloud',
    'https://www.galibrand.cloud'
  ];
  const origin = req.headers.origin;

  // Allow requests if the origin is in our whitelist, or if there's no origin (e.g., Postman, server-to-server).
  if (!origin || allowedOrigins.includes(origin)) {
    return next();
  }
  return res.status(403).json({ message: "Access from this origin is not permitted." });
};

router.get("/", checkOriginForPublicPlans, getPlans);

export default router;