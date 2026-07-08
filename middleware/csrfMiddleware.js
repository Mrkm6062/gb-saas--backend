import { parseCookies } from "../utils/cookieHelper.js";

export const csrfProtection = (req, res, next) => {
  // Skip CSRF check for GET, HEAD, OPTIONS
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Bypass CSRF checks for external webhook endpoints (e.g., Razorpay payment webhooks or public auth)
  if (
    req.path.includes("/webhook") || 
    req.path.includes("/auth/google") || 
    req.path.includes("/send-otp") ||
    req.path.includes("/verify-otp")
  ) {
    return next();
  }

  req.cookies = parseCookies(req.headers.cookie);
  const cookieCsrfToken = req.cookies.csrfToken;
  const headerCsrfToken = req.headers["x-csrf-token"];

  if (!cookieCsrfToken || !headerCsrfToken || cookieCsrfToken !== headerCsrfToken) {
    return res.status(403).json({ message: "Invalid or missing CSRF token." });
  }

  next();
};
