import mongoose from "mongoose";

const platformSocialMediaSchema = new mongoose.Schema({
  platform: { type: String, required: true }, // e.g., Facebook, Instagram
  url: { type: String, required: true }
}, {
  timestamps: true
});

export default mongoose.models.PlatformSocialMedia || mongoose.model("PlatformSocialMedia", platformSocialMediaSchema);