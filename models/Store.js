import mongoose from "mongoose";

const storeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    subdomain: { type: String, unique: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    plan: { type: String, default: "free" },
    planExpiry: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("Store", storeSchema);