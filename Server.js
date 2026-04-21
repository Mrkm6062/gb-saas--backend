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


dotenv.config();
connectDB();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

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

// 🔥 MULTI-TENANT MIDDLEWARE (GLOBAL FOR BELOW ROUTES)
app.use(subdomainMiddleware);
app.use(storeResolver);

// Routes
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payment", paymentRoutes);

// Error fallback
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

const PORT = process.env.PORT || 3011;

app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);