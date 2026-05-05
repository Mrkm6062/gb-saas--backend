import mongoose from "mongoose";

const deliverySettingsSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },
    deliveryMode: {
      type: String,
      enum: ["all", "state", "pincode"],
      default: "all",
    },
    allowedStates: [
      {
        type: String,
      },
    ],
    allowedPincodes: [
      {
        type: String,
      },
    ],
    baseCharge: {
      type: Number,
      default: 0,
    },
    freeShippingThreshold: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.models.DeliverySettings || mongoose.model("DeliverySettings", deliverySettingsSchema);