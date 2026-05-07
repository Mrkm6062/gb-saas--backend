import mongoose from "mongoose";

const platformPaymentSettingsSchema = new mongoose.Schema(
  {
    razorpayEnabled: { type: Boolean, default: false },
    razorpayKeyId: { type: String, default: "" },
    razorpayKeySecret: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.models.PlatformPaymentSettings || 
  mongoose.model("PlatformPaymentSettings", platformPaymentSettingsSchema);