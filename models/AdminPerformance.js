import mongoose from "mongoose";

const adminPerformanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SuperAdminStaff",
      required: true,
      unique: true
    },
    monthlyTarget: {
      type: Number,
      default: 10
    },
    performanceRating: {
      type: Number,
      default: 5.0
    },
    keyPerformanceSettings: {
      type: String,
      default: "Acquire new merchants and onboard them onto the platform."
    },
    commissionPercentage: {
      type: Number,
      default: 10 // 10% default commission
    }
  },
  { timestamps: true }
);

export default mongoose.models.AdminPerformance || mongoose.model("AdminPerformance", adminPerformanceSchema);
