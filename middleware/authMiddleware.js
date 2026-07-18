import jwt from "jsonwebtoken";
import User from "../models/User.js";
import SuperAdminStaff from "../models/SuperAdminStaff.js";
import { parseCookies } from "../utils/cookieHelper.js";

const protect = async (req, res, next) => {
  req.cookies = parseCookies(req.headers.cookie);
  let token = req.cookies.accessToken;

  if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (token) {
    try {
      // Verify JWT with claims
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: "galibrand",
        audience: "store-owner-dashboard",
        algorithms: ["HS256"]
      });

      const userId = decoded.sub || decoded.id;

      // First check standard users
      let user = await User.findById(userId).select("-password");
      let isStaff = false;

      // Fallback to check if the token belongs to an internal staff member
      if (!user) {
        user = await SuperAdminStaff.findById(userId).select("-password");
        isStaff = true;
      }

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Block access immediately if the account is suspended
      if (user.Suspended) {
        return res.status(403).json({ message: "Your account has been suspended. Please contact the administrator." });
      }

      // VAPT: Validate session ID for Store Owners (non-staff, role 'user')
      if (!isStaff && user.role !== 'superadmin') {
        if (!decoded.sessionId || decoded.sessionId !== user.sessionId) {
          return res.status(401).json({ message: "Session expired. Please login again." });
        }
      }

      req.user = user;
      return next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: "Session expired. Please login again." });
      }
      return res.status(401).json({ message: "Not authorized, token invalid" });
    }
  }

  return res.status(401).json({ message: "Not authorized, no token provided" });
};

export { protect };