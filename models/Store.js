import mongoose from "mongoose";

const storeSchema = new mongoose.Schema({
  storeSlug: { type: String, required: true, unique: true },
  storeName: { type: String, required: true },
  websiteTitle: { type: String },
  logo: { type: String },
  favicon: { type: String },
  banner: { type: String },
  theme: { type: String, default: "default" }
}, {
  timestamps: true
});

export default mongoose.models.Store || mongoose.model("Store", storeSchema);