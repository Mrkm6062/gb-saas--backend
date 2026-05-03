const mongoose = require("mongoose");

const storePwaSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },

    domain: {
      type: String,
      required: true, // sameerprintwale.galibrand.cloud
    },

    // 🔹 App Info
    appName: {
      type: String,
      required: true,
    },

    shortName: {
      type: String,
      required: true,
      maxlength: 12,
    },

    description: {
      type: String,
      required: true,
    },

    themeColor: {
      type: String,
      default: "#000000",
    },

    backgroundColor: {
      type: String,
      default: "#ffffff",
    },

    // 🔹 Logos (GCS URLs)
    logo192: {
      type: String,
      required: true,
    },

    logo512: {
      type: String,
      required: true,
    },

    // optional extra sizes
    logo72: String,
    logo96: String,
    logo128: String,
    logo144: String,
    logo384: String,

    // 🔹 Feature flags
    isEnabled: {
      type: Boolean,
      default: false,
    },

    isApproved: {
      type: Boolean,
      default: false,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    approvedAt: Date,

    // 🔹 Status tracking
    status: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected"],
      default: "draft",
    },

    rejectionReason: String,

    // 🔹 Audit
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StorePWAConfig", storePwaSchema);