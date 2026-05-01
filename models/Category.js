import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      lowercase: true,
    },

    description: {
      type: String,
      default: "",
    },

    order: {
      type: Number,
      default: 0,
    },

    metaTitle: {
      type: String,
      default: "",
    },

    metaDescription: {
      type: String,
      default: "",
    },

    image: {
      url: { type: String },
      public_id: { type: String }, // if using cloudinary
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    level: {
      type: Number,
      default: 0, // 0 = main, 1 = subcategory
    },

    productCount: {
      type: Number,
      default: 0,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
  },
  { timestamps: true }
);

// Index for faster search
categorySchema.index({ name: "text", description: "text" });
categorySchema.index({ store: 1, slug: 1 }, { unique: true }); // Scoped uniqueness

export default mongoose.model("Category", categorySchema);