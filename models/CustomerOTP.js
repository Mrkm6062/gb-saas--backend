import mongoose from "mongoose";

const customerOTPSchema = new mongoose.Schema({
  email: { type: String, required: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true },
  otp: { type: String, required: true },
  // Automatically delete the OTP from the database after 10 minutes
  createdAt: { type: Date, expires: '10m', default: Date.now }
});

export default mongoose.models.CustomerOTP || mongoose.model("CustomerOTP", customerOTPSchema);