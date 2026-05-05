import mongoose from "mongoose";

const stateDistrictMapSchema = new mongoose.Schema({
  stateName: { type: String, required: true, unique: true },
  districts: [{ type: String }]
});

export default mongoose.models.StateDistrictMap || mongoose.model("StateDistrictMap", stateDistrictMapSchema);