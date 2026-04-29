import mongoose from "mongoose";

const socialMediaSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true },
  platform: { type: String, required: true }, // e.g., Facebook, Instagram
  url: { type: String, required: true }
}, {
  timestamps: true
});

export default mongoose.models.SocialMedia || mongoose.model("SocialMedia", socialMediaSchema);