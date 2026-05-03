import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },

    code: {
      type: String,
      required: true,
      uppercase: true, // Forces codes like 'summer50' to become 'SUMMER50'
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    discountType: {
      type: String,
      enum: ["percentage", "fixed", "free_shipping"],
      required: true,
      default: "percentage",
    },

    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },

    minOrderAmount: {
      type: Number,
      default: 0, // Minimum cart total required to apply the coupon
    },

    maxDiscountAmount: {
      type: Number,
      default: null, // Useful for percentage discounts (e.g., 20% off up to ₹500)
    },

    startDate: {
      type: Date,
      default: Date.now,
    },

    endDate: {
      type: Date,
      required: true, // When the coupon expires
    },

    usageLimit: {
      type: Number,
      default: null, // Maximum number of times this coupon can be used across the store (null = unlimited)
    },

    usageCount: {
      type: Number,
      default: 0, // Tracks how many times it has been used
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Ensure that a coupon code is unique within a specific store
// (e.g., Store A and Store B can both have a 'WELCOME10' coupon)
couponSchema.index({ storeId: 1, code: 1 }, { unique: true });

export default mongoose.models.Coupon || mongoose.model("Coupon", couponSchema);