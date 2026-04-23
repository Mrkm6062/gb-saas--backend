import mongoose from "mongoose";

const planSchema = new mongoose.Schema({
  name: { type: String, required: true, enum: ['Free', 'Pro', 'Premium'], unique: true },
  price: { type: Number, required: true }, // Monthly price
  features: {
    maxProducts: { type: Number, required: true, default: 50 },
    customDomain: { type: Boolean, default: false },
    analytics: { type: Boolean, default: false },
    themes: { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

export default mongoose.models.Plan || mongoose.model("Plan", planSchema);