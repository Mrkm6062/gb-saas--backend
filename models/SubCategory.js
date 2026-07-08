import mongoose from "mongoose";

const subCategorySchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
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
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    order: {
      type: Number,
      default: 0,
    }
  },
  { timestamps: true }
);

subCategorySchema.index({ store: 1, slug: 1 }, { unique: true });

export default mongoose.models.SubCategory || mongoose.model("SubCategory", subCategorySchema);
