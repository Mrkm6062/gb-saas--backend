import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";

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


dotenv.config();
connectDB();

const app = express();

app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(cors());

// Security Headers Middleware
app.use(
  helmet({
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
        imgSrc: ["'self'", "https://storage.googleapis.com", "data:"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", "https://*.galibrand.cloud"],
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

// Root check
app.get("/", (req, res) => {
  res.send("API Running...");
});

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

// 🔥 MULTI-TENANT MIDDLEWARE (GLOBAL FOR BELOW ROUTES)
app.use(storeResolver);

// Routes
app.use("/api/payment", paymentRoutes);

// Error fallback
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

const PORT = process.env.PORT || 3011;

app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);