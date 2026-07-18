import mongoose from "mongoose";

const customPageSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    pageType: {
      type: String,
      default: "custom",
    },
    description: {
      type: String,
      default: "",
    },
    isHomepage: {
      type: Boolean,
      default: false,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
    headHTML: {
      type: String,
      default: "",
    },
    bodyHTML: {
      type: String,
      default: "",
    },
    customCSS: {
      type: String,
      default: "",
    },
    customJS: {
      type: String,
      default: "",
    },
    seo: {
      metaTitle: { type: String, default: "" },
      metaDescription: { type: String, default: "" },
      keywords: { type: String, default: "" },
      canonical: { type: String, default: "" },
      robots: { type: String, default: "index, follow" },
      ogTitle: { type: String, default: "" },
      ogDescription: { type: String, default: "" },
      ogImage: { type: String, default: "" },
    },
    favicon: {
      type: String,
      default: "",
    },
    author: {
      type: String,
      default: "",
    },
    pageIcon: {
      type: String,
      default: "",
    },
    thumbnail: {
      type: String,
      default: "",
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes
customPageSchema.index({ storeId: 1, slug: 1 }, { unique: true });
customPageSchema.index({ storeId: 1, isHomepage: 1 });

export default mongoose.models.CustomPage || mongoose.model("CustomPage", customPageSchema);
