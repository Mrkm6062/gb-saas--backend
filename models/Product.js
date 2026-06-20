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

  // 🔹 BRAND / STORE (multi-tenant)
  storeId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Store", 
    required: true // Ensures product always belongs to a specific store
  },

  // 🔹 IMPORT TRACKING (To prevent duplicate default imports)
  source: { 
    type: String, 
    enum: ["custom", "default"], 
    default: "custom" 
  },
  defaultProductId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "DefaultProduct" 
  },

  // 🔹 IMAGES
  images: [String],

  // 🔹 VARIANTS (MAIN FEATURE)
  variants: [variantSchema],

  // 🔹 DEFAULT PRICE (fallback)
  basePrice: { type: Number },

  // 🔹 UNIT TYPE (important for your use case)
  unitType: {
    type: String,
    enum: ["kg", "gram", "piece", "plate", "pack", "size"]
  },

  // 🔹 TAGS
  tags: [String],

  // 🔹 INVENTORY
  totalStock: { type: Number, default: 0 },

  // 🔹 STATUS
  isActive: { type: Boolean, default: true },

  // 🔹 CUSTOMIZABLE (For custom image prints/gifts)
  isCustomizable: { type: Boolean, default: false },
  allowCustomText: { type: Boolean, default: false },

  customizableArea: {
    x: { type: Number, default: 25 },
    y: { type: Number, default: 25 },
    width: { type: Number, default: 50 },
    height: { type: Number, default: 50 },
  },

  // 🔹 SEO FIELDS
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String],
    canonicalUrl: String
  },

  // 🔹 RATINGS (future use)
  rating: { type: Number, default: 0 },
  reviewsCount: { type: Number, default: 0 }

}, { timestamps: true });

export default mongoose.models.Product || mongoose.model("Product", productSchema);