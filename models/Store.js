import mongoose from "mongoose";

const storeSchema = new mongoose.Schema(
  {
    // Basic Info
    storeName: { type: String, required: true },
    storeSlug: { type: String, unique: true }, // for URL (mystore.galibrand.cloud)
    storeId: { type: String, unique: true },

    // Ownership
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Plan & Billing
    plan: { type: String, enum: ["free", "basic", "pro"], default: "free" },
    billingCycle: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
    planStartDate: Date,
    planExpiryDate: Date,
    isTrialActive: { type: Boolean, default: true },

    // Store Status
    status: { type: String, enum: ["active", "inactive", "suspended"], default: "active" },

    // Domain Setup
    subdomain: String, // mystore.galibrand.cloud
    customDomain: String, // optional user domain

    // SEO & Classification
    metaDescription: String,
    category: String, // The selected shop category

    // Store Settings
    currency: { type: String, default: "INR" },
    timezone: { type: String, default: "Asia/Kolkata" },
    language: { type: String, default: "en" },

    // Contact Info
    email: String,
    phone: String,
    address: String,

    // Branding
    logo: String,
    banner: String,

    // Features / Limits (important for SaaS control)
    maxProducts: Number,
    maxOrdersPerMonth: Number,
    maxUsers: Number,

    // Analytics (basic counters)
    totalOrders: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },

    // Metadata
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export default mongoose.model("Store", storeSchema);