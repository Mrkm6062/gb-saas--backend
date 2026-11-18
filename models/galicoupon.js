import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    discountType: {
      type: String,
      enum: ["PERCENTAGE", "FIXED"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0, // e.g., 10 for 10% or 100 for ₹100 off
    },
    maxDiscountAmount: {
      type: Number,
      default: null, // Cap for PERCENTAGE discounts (e.g., 10% off up to ₹200)
    },
    minOrderAmount: {
      type: Number,
      default: 0, // Minimum cart value required to apply
    },
    validFrom: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    usageLimit: {
      type: Number,
      default: null, // Total global redemptions allowed (null = unlimited)
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    perUserLimit: {
      type: Number,
      default: 1, // How many times a single user can apply this code
    },
    usedBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        usageCount: {
          type: Number,
          default: 1,
        },
      },
    ],
    // Optional targeting rules
    firstOrderOnly: {
      type: Boolean,
      default: false,
    },
    applicableCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category", // Empty array = valid across all categories
      },
    ],
    applicableProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product", // Empty array = valid across all products
      },
    ],
    applicablePincodes: [
      {
        type: String,
        trim: true, // Useful for hyperlocal delivery zones
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast lookup during checkout validation
couponSchema.index({ code: 1, isActive: 1 });

export default mongoose.models.GaliCoupon || mongoose.model("GaliCoupon", couponSchema);
