import mongoose from "mongoose";

const domainSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store" },

  domain: {
    type: String,
    required: true,
    unique: true
  },

  status: {
    type: String,
    enum: ["pending", "connected", "failed"],
    default: "pending"
  },

  verificationToken: String,

  sslStatus: {
    type: String,
    enum: ["pending", "active", "failed"],
    default: "pending"
  },

  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Domain || mongoose.model("Domain", domainSchema);