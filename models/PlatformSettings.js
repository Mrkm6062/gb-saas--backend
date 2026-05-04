import mongoose from "mongoose";

const platformSettingsSchema = new mongoose.Schema({
  // Using a singleton pattern with a fixed key
  key: { type: String, default: "global", unique: true },
  
  mainLogoUrl: { type: String, default: "https://storage.googleapis.com/galibrand/superadmin/products/galibrandfullname-logo.png" },
  
  loginImageGrid: {
    type: [String],
    default: []
  }
}, { timestamps: true });

export default mongoose.models.PlatformSettings || mongoose.model("PlatformSettings", platformSettingsSchema);