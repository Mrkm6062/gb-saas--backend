import jwt from "jsonwebtoken";
import User from "../models/User.js";
import SuperAdminStaff from "../models/SuperAdminStaff.js";

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // First check standard users
      let user = await User.findById(decoded.id).select("-password");

      // Fallback to check if the token belongs to an internal staff member
      if (!user) {
        user = await SuperAdminStaff.findById(decoded.id).select("-password");
      }

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Block access immediately if the account is suspended
      if (user.Suspended) {
        return res.status(403).json({ message: "Your account has been suspended. Please contact the administrator." });
      }

      req.user = user;
      return next();
    } catch (error) {
      return res.status(401).json({ message: "Not authorized, token invalid" });
    }
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token provided" });
  }
};

export { protect };