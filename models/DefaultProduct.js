import mongoose from "mongoose";

const variantSchema = new mongoose.Schema({
  name: { type: String }, // "1kg", "XL", "Red"

  attributes: {
    type: Map,
    of: String
    // { size: "XL", color: "Red" }
  },

  // 🔥 NEW: Variant Images
  images: [
    {
      url: String,
      alt: String
    }
  ],

  // 🔥 Optional: thumbnail (fast loading)
  thumbnail: String,

  price: { type: Number, required: true },
  comparePrice: Number,

  stock: { type: Number, default: 0 },
  sku: String,

  isDefault: { type: Boolean, default: false }

}, { _id: true });

const productSchema = new mongoose.Schema({
  // 🔹 BASIC INFO
  name: { type: String, required: true },
  slug: { type: String, unique: true }, // SEO URL
  description: { type: String },

  // 🔹 CATEGORY SUPPORT (multi-use)
  category: { type: String },
  foodtype: { type: String }, // "Non-Veg", "Veg", "Vegan", "Gluten-Free" 
  subCategory: { type: String },

  // Example:
  // "vegetable", "nasta", "restaurant", "clothes", "kirana"

  // 🔹 STORE TYPES (Used to group default products)
  storeTypes: [{ 
    type: String 
  }],

  // 🔹 IMAGES
  images: [String],

  // 🔹 VARIANTS (MAIN FEATURE)
  variants: [variantSchema],

  // 🔹 DEFAULT PRICE (fallback)
  basePrice: { type: Number },

  // 🔹 UNIT TYPE (important for your use case)
  unitType: {
    type: String,
    enum: ["kg", "gram", "piece", "plate", "pack", "bottle", "box", "liter", "ml", "dozen", "packet", "size", "set", "other"],
  },

  // 🔹 TAGS
  tags: [String],

  // 🔹 INVENTORY
  totalStock: { type: Number, default: 0 },

  // 🔹 STATUS
  isActive: { type: Boolean, default: true },

  // 🔹 SEO FIELDS
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String],
    canonicalUrl: String
  },

  // 🔹 RATINGS (future use)
  rating: { type: Number, default: 0 },
  reviewsCount: { type: Number, default: 0 },

  // 🔹 KEY FEATURES & SPECIFICATIONS
  keyFeaturesEnabled: { type: Boolean, default: false },
  specificationsEnabled: { type: Boolean, default: false },
  keyFeatures: [String],
  specifications: [{
    name: String,
    value: String
  }]

}, { timestamps: true });

export default mongoose.models.DefaultProduct || mongoose.model("DefaultProduct", productSchema);