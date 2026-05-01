import mongoose from "mongoose";

const planSchema = new mongoose.Schema({
  name: { type: String, required: true, enum: ['Basic', 'Pro', 'Premium'], unique: true },
  price: { type: Number, required: true }, // Monthly price
  features: {
    maxProducts: { type: Number, required: true, default: 20 },
    customDomain: { type: Boolean, default: false },
    analytics: { type: Boolean, default: false },
    themes: { type: Boolean, default: false },
    storageLimit: { type: Number, default: 500 }, // Add this line! (500 = 500MB, 2000 = 2GB)
    storeLimit: { type: Number, default: 1}, 
    freeSsl: { type: Boolean, default: false },
    securityHeaders: { type: Boolean, default: false },
    basicanalytics: { type: Boolean, default: false },
    advanceanalytics: { type: Boolean, default: false },
    whatsappOrderButton: { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

export default mongoose.models.Plan || mongoose.model("Plan", planSchema);