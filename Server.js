import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import connectDB from "./config/db.js";
import { subdomainMiddleware } from "./middleware/subdomain.js";
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


dotenv.config();
connectDB();

const app = express();

app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(cors());

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

// 🔥 MULTI-TENANT MIDDLEWARE (GLOBAL FOR BELOW ROUTES)
app.use(subdomainMiddleware);
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