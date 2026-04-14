import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import connectDB from "./config/db.js";
import storeMiddleware from "./middleware/storeMiddleware.js";

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

// 🔥 MULTI-TENANT MIDDLEWARE (GLOBAL)
app.use(storeMiddleware);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/store", storeRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payment", paymentRoutes);

// Root check
app.get("/", (req, res) => {
  res.send("API Running...");
});

// Error fallback
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

const PORT = process.env.PORT || 3011;

app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);