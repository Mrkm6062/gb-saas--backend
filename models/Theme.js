import mongoose from "mongoose";

const themeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    themeId: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    type: {
      type: String,
      enum: ["free", "paid", "premium"],
      default: "free",
    },

    category: {
      type: [String], // multiple allowed
      enum: [
        "restaurant",
        "nasta",
        "vegetable",
        "ecommerce",
        "clothing",
        "kirana",
        "general",
      ],
      default: ["general"],
    },

    description: {
      type: String,
    },

    previewImage: {
      type: String, // screenshot URL
    },

    themeFolder: {
      type: String,
      required: true, // MUST match frontend folder
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    price: {
      type: Number,
      default: 0,
    },

    version: {
      type: String,
      default: "1.0",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Tracks which Superadmin added the theme
    },
  },
  { timestamps: true }
);

export default mongoose.model("Theme", themeSchema);