import { parseCookies } from "../utils/cookieHelper.js";

export const csrfProtection = (req, res, next) => {
  // Skip CSRF check for GET, HEAD, OPTIONS
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Bypass CSRF checks for external webhook endpoints, public auth, and file upload endpoints
  if (
    req.path.includes("/webhook") || 
    req.path.includes("/auth/google") || 
    req.path.includes("/send-otp") ||
    req.path.includes("/verify-otp") ||
    req.path.includes("/upload") ||
    req.path.includes("/custom-assets/upload")
  ) {
    return next();
  }

  req.cookies = parseCookies(req.headers.cookie);
  const accessToken = req.cookies.accessToken;

  // If there is no accessToken cookie, this is a storefront/public API or Superadmin using Bearer token headers.
  // Since headers-based authentication and public routes are immune to CSRF, we skip the check.
  if (!accessToken) {
    return next();
  }

  const cookieCsrfToken = req.cookies.csrfToken;
  const headerCsrfToken = req.headers["x-csrf-token"];

  if (!cookieCsrfToken || !headerCsrfToken || cookieCsrfToken !== headerCsrfToken) {
    return res.status(403).json({ message: "Invalid or missing CSRF token." });
  }

  next();
};
