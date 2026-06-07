import mongoose from "mongoose";

const storeSchema = new mongoose.Schema({
  storetypeId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  features: { type: [String], default: [] },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

export default mongoose.models.StoreType || mongoose.model("StoreType", storeSchema);