import mongoose from "mongoose";

const offerCategorySchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
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
    banner: {
      type: String,
      default: "",
    },
    icon: {
      type: String,
      default: "",
    },
    color: {
      type: String,
      default: "#76b900",
    },
    priority: {
      type: Number,
      default: 0,
    },
    homepageSection: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: true,
    },
    productCount: {
      type: Number,
      default: 0,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    offerType: {
      type: String,
      enum: ["B1G1", "B2G1", "DISCOUNT", "NONE"],
      default: "NONE",
    },
    discountPercentage: {
      type: Number,
      default: 0,
    }
  },
  { timestamps: true }
);

offerCategorySchema.index({ store: 1, slug: 1 }, { unique: true });

export default mongoose.models.OfferCategory || mongoose.model("OfferCategory", offerCategorySchema);
