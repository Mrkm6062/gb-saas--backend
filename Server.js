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
import imageRoutes from "./routes/imageRoutes.js";
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
import { startSubscriptionReminderCron } from "./middleware/subscriptionReminder.js";
import { startCleanupDeletedStoresCron } from "./middleware/cleanupDeletedStores.js";
import { startCleanupCustomImagesCron } from "./middleware/cleanupCustomImages.js";
import defaultProductRoutes from "./routes/defaultProductRoutes.js";
import superadminDefaultProductRoutes from "./routes/superadminDefaultProductRoutes.js";
import themePaymentRoutes from "./routes/themePaymentRoutes.js";
import themeRoutes from "./routes/themeRoutes.js";
import superadminThemeRoutes from "./routes/superadminThemeRoutes.js";
import themeCustomizationRoutes from "./routes/themeCustomizationRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import superadminStaffRoutes from "./routes/superadminStaffRoutes.js";
import storeTypeRoutes from "./routes/storeTypeRoutes.js";
import superadminStaffPerformanceRoutes from "./routes/superadminstaffperformanceroutes.js";
import salaryCommissionRoutes from "./routes/salaryCommissionRoutes.js";
import Domain from "./models/Domain.js";
import Product from "./models/Product.js";
import Category from "./models/Category.js";


dotenv.config();
connectDB();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Initialize scheduled cron jobs
startSubscriptionReminderCron();
startCleanupDeletedStoresCron();
startCleanupCustomImagesCron();

app.set('trust proxy', 1);

// Bulletproof Manual CORS Middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-store-id, x-store, x-store-code, x-store-domain, x-forwarded-host, Origin, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json());

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
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://static.cloudflareinsights.com",
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        frameSrc: ["'self'", "https://www.google.com"],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https://storage.googleapis.com",
          "https://*.gstatic.com",
          "https://*.galibrand.cloud",
          "http://localhost:*",
          "http://127.0.0.1:*",
        ],
        connectSrc: ["'self'", "*"],
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

// Dynamic robots.txt route
app.get("/robots.txt", async (req, res) => {
  try {
    if (!req.store) {
      res.type("text/plain");
      return res.send("User-agent: *\nDisallow: /api\nDisallow: /dashboard\nSitemap: https://galibrand.cloud/sitemap.xml");
    }

    const domainRecord = await Domain.findOne({ storeId: req.store._id, status: "connected" });
    const storeDomain = domainRecord 
      ? `https://${domainRecord.domain}` 
      : `https://${req.store.subdomain || `${req.store.storeSlug}.galibrand.cloud`}`;

    res.type("text/plain");
    res.send(`User-agent: *\nAllow: /\nDisallow: /track\nDisallow: /cart\nSitemap: ${storeDomain}/sitemap.xml`);
  } catch (error) {
    console.error("robots.txt generation error:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Dynamic sitemap.xml route
app.get("/sitemap.xml", async (req, res) => {
  try {
    if (!req.store) {
      res.type("application/xml");
      return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://galibrand.cloud/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`);
    }

    const domainRecord = await Domain.findOne({ storeId: req.store._id, status: "connected" });
    const storeDomain = domainRecord 
      ? `https://${domainRecord.domain}` 
      : `https://${req.store.subdomain || `${req.store.storeSlug}.galibrand.cloud`}`;

    const [categories, products] = await Promise.all([
      Category.find({ store: req.store._id, status: "active" }).select("slug _id"),
      Product.find({ storeId: req.store._id, isActive: true }).select("slug _id")
    ]);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    xml += `  <url>\n`;
    xml += `    <loc>${storeDomain}/</loc>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>1.0</priority>\n`;
    xml += `  </url>\n`;

    for (const cat of categories) {
      const catSlug = cat.slug || cat._id.toString();
      xml += `  <url>\n`;
      xml += `    <loc>${storeDomain}/category/${catSlug}</loc>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    }

    for (const prod of products) {
      const prodSlug = prod.slug || prod._id.toString();
      xml += `  <url>\n`;
      xml += `    <loc>${storeDomain}/product/${prodSlug}</loc>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.7</priority>\n`;
      xml += `  </url>\n`;
    }

    xml += `</urlset>`;

    res.type("application/xml");
    res.send(xml);
  } catch (error) {
    console.error("sitemap.xml generation error:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Status check for frontend
app.get("/api/status", (req, res) => {
  res.status(200).json({ message: "API connection is successful!" });
});

// 🚀 GLOBAL ROUTES (No store context required)
app.use("/api/auth", authRoutes); // Users can login/register
app.use("/api/store", storeRoutes); // Users can create/manage their stores
app.use("/api/products", productRoutes); // Admin product management
app.use("/api/default-products", defaultProductRoutes); // Default products catalog
app.use("/api/superadmin/themes", superadminThemeRoutes); // Superadmin Theme Management
app.use("/api/superadmin/default-products", superadminDefaultProductRoutes); // Superadmin Default Products
app.use("/api/superadmin", superadminRoutes); // Superadmin access
app.use("/api/staff", superadminStaffRoutes); // Superadmin Staff Management
app.use("/api/staff-performance", superadminStaffPerformanceRoutes); // Staff Performance Routes
app.use("/api/salary-commission", salaryCommissionRoutes); // Salary & Commission Payout Routes
app.use("/api/themes", themeRoutes); // Store owner active theme fetching
app.use("/api/theme-customization", themeCustomizationRoutes); // Theme customization
app.use("/api/reviews", reviewRoutes); // Product Reviews
app.use("/api/plans", planRoutes); // Public plan fetching
app.use("/api/store-types", storeTypeRoutes); // Store Types management
app.use("/api/orders", orderRoutes); // Orders (handles both storefront & admin)
app.use("/api/policies", policyRoutes); // Store policies (handles both storefront & admin)
app.use("/api/upload", uploadRoutes); // Media uploads
app.use("/api/images", imageRoutes); // Image optimization and delivery
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
app.use("/api/theme-payments", themePaymentRoutes); // Paid theme purchases
app.use("/api/platform-payments", platformPaymentRoutes); // Superadmin SaaS Payments


// Routes
app.use("/api/payment", paymentRoutes);

// 🔥 SERVE REACT FRONTEND (Must be placed AFTER API routes)
// Standard Vite build outputs to /dist. Change to /build if using CRA.
const frontendPath = process.env.STOREFRONT_BUILD_PATH || path.join(__dirname, "../store-frontend/dist");
app.use(express.static(frontendPath, { index: false }));

app.get("*", async (req, res) => {
  // Handle dynamic robots.txt if it falls through to the wildcard route
  if (req.path === "/robots.txt" || req.path === "/robots.txt/") {
    try {
      if (!req.store) {
        res.type("text/plain");
        return res.send("User-agent: *\nDisallow: /api\nDisallow: /dashboard\nSitemap: https://galibrand.cloud/sitemap.xml");
      }

      const domainRecord = await Domain.findOne({ storeId: req.store._id, status: "connected" });
      const storeDomain = domainRecord 
        ? `https://${domainRecord.domain}` 
        : `https://${req.store.subdomain || `${req.store.storeSlug}.galibrand.cloud`}`;

      res.type("text/plain");
      return res.send(`User-agent: *\nAllow: /\nDisallow: /track\nDisallow: /cart\nSitemap: ${storeDomain}/sitemap.xml`);
    } catch (error) {
      console.error("robots.txt wildcard error:", error);
      res.type("text/plain");
      return res.send("User-agent: *\nAllow: /");
    }
  }

  // Handle dynamic sitemap.xml if it falls through to the wildcard route
  if (req.path === "/sitemap.xml" || req.path === "/sitemap.xml/") {
    try {
      if (!req.store) {
        res.type("application/xml");
        return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://galibrand.cloud/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`);
      }

      const domainRecord = await Domain.findOne({ storeId: req.store._id, status: "connected" });
      const storeDomain = domainRecord 
        ? `https://${domainRecord.domain}` 
        : `https://${req.store.subdomain || `${req.store.storeSlug}.galibrand.cloud`}`;

      const [categories, products] = await Promise.all([
        Category.find({ store: req.store._id, status: "active" }).select("slug _id"),
        Product.find({ storeId: req.store._id, isActive: true }).select("slug _id")
      ]);

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

      xml += `  <url>\n`;
      xml += `    <loc>${storeDomain}/</loc>\n`;
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>1.0</priority>\n`;
      xml += `  </url>\n`;

      for (const cat of categories) {
        const catSlug = cat.slug || cat._id.toString();
        xml += `  <url>\n`;
        xml += `    <loc>${storeDomain}/category/${catSlug}</loc>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.8</priority>\n`;
        xml += `  </url>\n`;
      }

      for (const prod of products) {
        const prodSlug = prod.slug || prod._id.toString();
        xml += `  <url>\n`;
        xml += `    <loc>${storeDomain}/product/${prodSlug}</loc>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.7</priority>\n`;
        xml += `  </url>\n`;
      }

      xml += `</urlset>`;

      res.type("application/xml");
      return res.send(xml);
    } catch (error) {
      console.error("sitemap.xml wildcard error:", error);
      return res.status(500).send("Internal Server Error");
    }
  }

  // Prevent returning index.html for static assets (fixes MIME type errors)
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|json|woff|woff2|ttf|eot)$/)) {
    return res.status(404).send("Static file not found");
  }

  // Prevent Cloudflare and browsers from caching the index.html and its security headers
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

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
        html = html.replace(/<link[^>]*rel="'?icon["'][^>]*>/i, `<link rel="icon" href="${req.store.favicon}" />`);
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