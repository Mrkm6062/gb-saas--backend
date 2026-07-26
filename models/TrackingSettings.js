import mongoose from "mongoose";

const trackingSettingsSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      unique: true,
      index: true,
    },

    // -------------------------
    // Google Analytics 4
    // Example: G-ABC123XYZ
    // -------------------------
    googleAnalytics: {
      measurementId: {
        type: String,
        trim: true,
        default: "",
      },
      enabled: {
        type: Boolean,
        default: false,
      },
    },

    // -------------------------
    // Google Tag Manager
    // Example: GTM-XXXXXXX
    // -------------------------
    googleTagManager: {
      containerId: {
        type: String,
        trim: true,
        default: "",
      },
      enabled: {
        type: Boolean,
        default: false,
      },
    },

    // -------------------------
    // Google Search Console
    // Verification Meta Content
    // Example:
    // google-site-verification=xxxxxxxx
    // Store only the verification value.
    // -------------------------
    googleSearchConsole: {
      verificationCode: {
        type: String,
        trim: true,
        default: "",
      },
      enabled: {
        type: Boolean,
        default: false,
      },
      verifiedAt: {
        type: Date,
      },
    },

    // -------------------------
    // Meta / Facebook Pixel
    // Example: 123456789012345
    // -------------------------
    facebookPixel: {
      pixelId: {
        type: String,
        trim: true,
        default: "",
      },
      enabled: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.TrackingSettings || mongoose.model(
  "TrackingSettings",
  trackingSettingsSchema
);
