import mongoose from "mongoose";

const salaryCommissionSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true
    },
    employeeName: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    month: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ["salary", "commission"],
      required: true
    },
    invoiceId: {
      type: String,
      required: true,
      unique: true
    },
    status: {
      type: String,
      default: "Paid"
    },
    paidAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

export default mongoose.models.SalaryCommission || mongoose.model("SalaryCommission", salaryCommissionSchema);
