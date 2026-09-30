import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { parseCookies } from "../utils/cookieHelper.js";
import {
  getVapidPublicKey,
  subscribe,
  unsubscribe,
  testPushNotification,
} from "../controllers/notificationController.js";

const router = express.Router();

const optionalProtect = async (req, res, next) => {
  try {
    req.cookies = parseCookies(req.headers.cookie);
    let token = req.cookies.accessToken;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: "galibrand",
        audience: "store-owner-dashboard",
        algorithms: ["HS256"],
      });
      const userId = decoded.sub || decoded.id;
      req.user = await User.findById(userId).select("-password");
    }
  } catch (err) {
    // Continue without req.user
  }
  next();
};

router.get("/vapid-key", getVapidPublicKey);
router.post("/subscribe", optionalProtect, subscribe);
router.post("/unsubscribe", unsubscribe);
router.post("/test", optionalProtect, testPushNotification);

export default router;
