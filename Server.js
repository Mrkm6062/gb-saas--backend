import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

import connectDB from "./config/db.js";
import { subdomainMiddleware } from "./middleware/subdomain.js";
import { domainMiddleware } from "./middleware/domainMiddleware.js";
import { storeResolver } from "./middleware/storeResolver.js";

// Routes
import authRoutes from "./routes/authRoutes.js";
import storeRoutes from "./routes/storeRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import superadminRoutes from "./routes/superadminRoutes.js";
import planRoutes from "./routes/planRoutes.js";
import User from "./models/User.js";
import policyRoutes from "./routes/policyRoutes.js";
import Policy from "./models/Policy.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import socialMediaRoutes from "./routes/socialMediaRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import platformPolicyRoutes from "./routes/platformPolicyRoutes.js";
import platformSocialMediaRoutes from "./routes/platformSocialMediaRoutes.js";
import domainRoutes from "./routes/domainRoutes.js";
import { getPlatformSettings } from "./controllers/platformSettingsController.js";
import couponRoutes from "./routes/couponRoutes.js";
import storeAlertsRoutes from "./routes/storeAlertsRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import deliveryRoutes from "./routes/deliveryRoutes.js";
import checkoutRoutes from "./routes/checkoutRoutes.js";
import { getPublicOrder, sendCustomerOtp, verifyCustomerOtp, getCustomerOrders } from "./controllers/orderController.js";
import platformPaymentRoutes from "./routes/platformPaymentRoutes.js";


dotenv.config();
connectDB();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(cors());

// Security Headers Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
    frameguard: {
      action: "sameorigin",
    },
    referrerPolicy: {
      policy: "strict-origin-when-cross-origin",
    },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "https://storage.googleapis.com", "data:", "blob:"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://static.cloudflareinsights.com"],
        scriptSrcElem: ["'self'", "'unsafe-inline'", "https://static.cloudflareinsights.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        styleSrcElem: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://fonts.googleapis.com", "data:"],
        connectSrc: ["'self'", "https://*.galibrand.cloud", "https://cloudflareinsights.com"],
      },
    },
  })
);

// Set Permissions-Policy manually as it is not fully managed by Helmet v6 natively
app.use((req, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

// Seed Superadmin Account
const seedSuperAdmin = async () => {
  try {
    const adminExists = await User.findOne({ email: "galibrand99@gmail.com" });
    if (!adminExists) {
      await User.create({
        userId: "GBSUPERADMIN",
        name: "Super Admin",
        email: "galibrand99@gmail.com",
        password: "!rTMMeL0", // IMPORTANT: Change this password after first login!
        role: "superadmin"
      });
      console.log("✅ Superadmin account seeded successfully.");
    }
  } catch (error) {
    console.error("❌ Failed to seed superadmin:", error);
  }
};
seedSuperAdmin();

// 🔥 MULTI-TENANT MIDDLEWARE (GLOBAL FOR BELOW ROUTES)
app.use(storeResolver);

// Status check for frontend
app.get("/api/status", (req, res) => {
  res.status(200).json({ message: "API connection is successful!" });
});

// 🚀 GLOBAL ROUTES (No store context required)
app.use("/api/auth", authRoutes); // Users can login/register
app.use("/api/store", storeRoutes); // Users can create/manage their stores
app.use("/api/products", productRoutes); // Admin product management
app.use("/api/superadmin", superadminRoutes); // Superadmin access
app.use("/api/plans", planRoutes); // Public plan fetching
app.use("/api/orders", orderRoutes); // Orders (handles both storefront & admin)
app.use("/api/policies", policyRoutes); // Store policies (handles both storefront & admin)
app.use("/api/upload", uploadRoutes); // Media uploads
app.use("/api/social-media", socialMediaRoutes); // Social media links
app.use("/api/categories", categoryRoutes); // Store Categories
app.use("/api/platform-policies", platformPolicyRoutes); // Global platform policies
app.use("/api/platform-social-media", platformSocialMediaRoutes); // Global platform social links
app.use("/api/domains", domainRoutes); // Custom domain manager
app.use("/api/platform-settings", getPlatformSettings); // Public platform settings
app.use("/api/coupons", couponRoutes); // Coupons for stores
app.use("/api/store-alerts", storeAlertsRoutes); // Custom Store Email Alerts
app.use("/api/customers", customerRoutes); // Customer Management & Notes
app.use("/api/delivery-settings", deliveryRoutes); // Delivery Settings
app.use("/api/checkout-settings", checkoutRoutes); // Checkout & Payment Settings
app.get("/api/public-order/:id", getPublicOrder); // Public order tracking
app.post("/api/customers/auth/send-otp", sendCustomerOtp); // Customer OTP auth
app.post("/api/customers/auth/verify-otp", verifyCustomerOtp); // Customer OTP verify
app.get("/api/customers/auth/orders", getCustomerOrders); // Get Customer orders
app.use("/api/platform-payments", platformPaymentRoutes); // Superadmin SaaS Payments


// Routes
app.use("/api/payment", paymentRoutes);

// 🔥 SERVE REACT FRONTEND (Must be placed AFTER API routes)
// Standard Vite build outputs to /dist. Change to /build if using CRA.
const frontendPath = process.env.STOREFRONT_BUILD_PATH || path.join(__dirname, "../store-frontend/dist");
app.use(express.static(frontendPath, { index: false }));

app.get("*", async (req, res) => {
  // Prevent returning index.html for static assets (fixes MIME type errors)
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|json|woff|woff2|ttf|eot)$/)) {
    return res.status(404).send("Static file not found");
  }

  try {
    // Read the file dynamically so it always has the latest built JS/CSS hashes
    let html = await fs.readFile(path.join(frontendPath, "index.html"), "utf8");
    
    if (req.store) {
      const storeTitle = req.store.websiteTitle || req.store.name || "Loading...";
      let titleAndMeta = `<title>${storeTitle}</title>`;
      
      if (req.store.metaDescription) {
        // Remove existing description meta tag if present to avoid duplicates
        html = html.replace(/<meta\s+name=["']description["']\s+content=["'][^"']*["']\s*\/?>/i, '');
        titleAndMeta += `\n    <meta name="description" content="${req.store.metaDescription}" />`;
      }
      
      html = html.replace(/<title>.*?<\/title>/, titleAndMeta);
      
      if (req.store.favicon) {
        html = html.replace('href="/favicon.ico?v=2"', `href="${req.store.favicon}"`);
      }
    }
    
    res.send(html);
  } catch (err) {
    res.sendFile(path.join(frontendPath, "index.html"));
  }
});

// Error fallback
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

const PORT = process.env.PORT || 3011;

app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);