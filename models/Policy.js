import mongoose from "mongoose";

const policySchema = new mongoose.Schema({
  storeId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Store", 
    required: true 
  },
  title: { type: String, required: true },
  description: { type: String, required: true }
}, { timestamps: true });

export default mongoose.models.Policy || mongoose.model("Policy", policySchema);