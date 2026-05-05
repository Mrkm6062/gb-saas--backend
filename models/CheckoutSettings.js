import mongoose from "mongoose";

const checkoutSettingsSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
    codEnabled: { type: Boolean, default: true },
    whatsappEnabled: { type: Boolean, default: false },
    whatsappNumber: { type: String, default: "" },
    razorpayEnabled: { type: Boolean, default: false },
    razorpayKeyId: { type: String, default: "" },
    razorpayKeySecret: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.models.CheckoutSettings || mongoose.model("CheckoutSettings", checkoutSettingsSchema);