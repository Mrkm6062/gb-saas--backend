import mongoose from "mongoose";

const storeSchema = new mongoose.Schema({
  storeId: { type: String, required: true, unique: true },
  ownerId: { type: String, required: true },
  storeSlug: { type: String, required: true, unique: true },
  storeName: { type: String, required: true },
  empID: { type: String },
  subdomain: { type: String },
  storeType: { type: String },
  metaDescription: { type: String },
  status: { type: String, default: "active" },
  subscriptionStatus: { type: String, enum: ['active', 'expired', 'trial'], default: 'trial' },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan" },
  planStartDate: { type: Date },
  planExpiryDate: { type: Date },
  isTrialActive: { type: Boolean, default: true },
  trialPlanDays: { type: Number, default: 7 },
  websiteTitle: { type: String },
  logo: { type: String },
  favicon: { type: String },
  banner: { type: [String], default: [] },
  theme: { type: String, default: "default-theme" },
  paidThemes: [{
    themeId: { type: String, required: true },
    purchaseDate: { type: Date, default: Date.now },
    transactionId: { type: String, required: true }
}],
  supportPhoneNumbers: { type: [String], default: [] },
  supportEmail: { type: String, default: "" },
  locationAddress: { type: String, default: "" },
  mapLocation: { type: String, default: "" },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date }
}, {
  timestamps: true
});

export default mongoose.models.Store || mongoose.model("Store", storeSchema);