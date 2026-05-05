import mongoose from "mongoose";

const pincodeSchema = new mongoose.Schema({
  officeName: { type: String, required: true },
  pincode: { type: Number, required: true, index: true },
  officeType: String,
  deliveryStatus: String,
  districtName: { type: String, required: true, index: true },
  stateName: { type: String, required: true, index: true },
  deliverable: { type: Boolean, default: false, index: true }
});

pincodeSchema.index({ pincode: 1, officeName: 1 }, { unique: true });

export default mongoose.models.Pincode || mongoose.model("Pincode", pincodeSchema);