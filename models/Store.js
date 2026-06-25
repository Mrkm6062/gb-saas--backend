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
  billingHistory: [{
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan" },
    planName: String,
    amount: Number,
    date: { type: Date, default: Date.now },
    transactionId: String,
    invoiceId: String
  }],
  supportPhoneNumbers: { type: [String], default: [] },
  whatsappNumber: { type: String, default: "" },
  whatsappSupportEnabled: { type: Boolean, default: false },
  supportEmail: { type: String, default: "" },
  locationAddress: { type: String, default: "" },
  mapLocation: { type: String, default: "" },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  seoSettings: {
    indexWebsite: {
      type: Boolean,
      default: true
    },
    generateSitemap: {
      type: Boolean,
      default: true
    },
    sitemapIncludeProducts: {
      type: Boolean,
      default: true
    },
    sitemapIncludeCategories: {
      type: Boolean,
      default: true
    },
    sitemapIncludePages: {
      type: Boolean,
      default: true
    },
    allowAllBots: {
      type: Boolean,
      default: true
    },
    allowAiSearch: {
      type: Boolean,
      default: true
    },
    allowAiInput: {
      type: Boolean,
      default: true
    },
    allowAiTraining: {
      type: Boolean,
      default: false
    },
    blockGPTBot: {
      type: Boolean,
      default: false
    },
    blockClaudeBot: {
      type: Boolean,
      default: false
    },
    blockGoogleExtended: {
      type: Boolean,
      default: false
    },
    blockMetaExternalAgent: {
      type: Boolean,
      default: false
    },
    blockAmazonBot: {
      type: Boolean,
      default: false
    },
    blockApplebotExtended: {
      type: Boolean,
      default: false
    },
    metaTitle: {
      type: String,
      default: ''
    },
    metaDescription: {
      type: String,
      default: ''
    },
    metaKeywords: {
      type: [String],
      default: []
    },
    canonicalDomain: {
      type: String,
      default: ''
    },
    customRobotsContent: {
      type: String,
      default: ''
    },
    customLlmsContent: {
      type: String,
      default: ''
    }
  }
}, {
  timestamps: true
});

export default mongoose.models.Store || mongoose.model("Store", storeSchema);