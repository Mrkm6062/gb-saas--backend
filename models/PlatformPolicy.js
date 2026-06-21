import mongoose from "mongoose";

const platformPolicySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true
    },
    version: {
      type: String,
      default: "1.0"
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

export default mongoose.models.PlatformPolicy || mongoose.model("PlatformPolicy", platformPolicySchema);