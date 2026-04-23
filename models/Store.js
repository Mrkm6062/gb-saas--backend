import mongoose from "mongoose";

const storeSchema = new mongoose.Schema({
  storeId: { type: String, required: true, unique: true },
  ownerId: { type: String, required: true },
  storeSlug: { type: String, required: true, unique: true },
  storeName: { type: String, required: true },
  subdomain: { type: String },
  category: { type: String },
  storeType: { type: String },
  metaDescription: { type: String },
  status: { type: String, default: "active" },
  subscriptionStatus: { type: String, enum: ['active', 'expired', 'trial'], default: 'trial' },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan" },
  planStartDate: { type: Date },
  planExpiryDate: { type: Date },
  isTrialActive: { type: Boolean, default: true },
  websiteTitle: { type: String },
  logo: { type: String },
  favicon: { type: String },
  banner: { type: String },
  theme: { type: String, default: "default" }
}, {
  timestamps: true
});

export default mongoose.models.Store || mongoose.model("Store", storeSchema);