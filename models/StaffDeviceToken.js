import mongoose from "mongoose";

const staffDeviceTokenSchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },
    storeId: {
      type: String,
      default: "",
      index: true,
    },
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
      index: true,
    },
    staffCode: {
      type: String,
      default: "",
    },
    staffName: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      required: true,
      enum: ["kitchen", "delivery", "counter", "cashier", "manager", "waiter", "ordermanagement"],
      index: true,
    },
    fcmToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    platform: {
      type: String,
      default: "android",
    },
    deviceModel: {
      type: String,
      default: "",
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Compound indexes for rapid lookups
staffDeviceTokenSchema.index({ store: 1, role: 1 });
staffDeviceTokenSchema.index({ storeId: 1, role: 1 });

export default mongoose.models.StaffDeviceToken || mongoose.model("StaffDeviceToken", staffDeviceTokenSchema);
