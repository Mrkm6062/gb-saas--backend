import mongoose from "mongoose";

const pwaSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      unique: true,
      index: true,
    },

    enabled: {
      type: Boolean,
      default: false,
    },

    appName: {
      type: String,
      trim: true,
    },

    shortName: {
      type: String,
      trim: true,
      maxlength: 12,
    },

    themeColor: {
      type: String,
      default: "#16A34A",
    },

    backgroundColor: {
      type: String,
      default: "#FFFFFF",
    },

    icon192: {
      type: String,
      trim: true,
    },

    icon512: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

pwaSchema.pre("validate", function (next) {
  if (!this.enabled) return next();

  const requiredFields = [
    "appName",
    "shortName",
    "icon192",
    "icon512",
  ];

  for (const field of requiredFields) {
    if (!this[field]) {
      this.invalidate(field, `${field} is required when PWA is enabled.`);
    }
  }

  next();
});

export default mongoose.models.Pwa || mongoose.model("Pwa", pwaSchema);
