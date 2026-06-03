import jwt from "jsonwebtoken";
import User from "../models/User.js";
import SuperAdminStaff from "../models/SuperAdminStaff.js";

export const protectSuperadmin = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      let user = await User.findById(decoded.id).select("-password");
      let isStaff = false;

      // Fallback to check if the token belongs to an internal staff member
      if (!user) {
        user = await SuperAdminStaff.findById(decoded.id).select("-password");
        if (user) isStaff = true;
      }

      if (!user) {
        return res.status(401).json({ message: "Not authorized, user not found." });
      }

      // If they are a standard User, they MUST be a superadmin. If they are staff, they are allowed in.
      if (!isStaff && user.role !== 'superadmin') {
        return res.status(403).json({ message: "Access denied. Superadmin only." });
      }

      // Block access immediately if the account is suspended
      if (user.Suspended) {
        return res.status(403).json({ message: "Your account has been suspended. Please contact the administrator." });
      }

      req.user = user;
      next();
    } catch (error) {
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  } else {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};