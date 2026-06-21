import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    EmployeeId: { type: String, unique: true },
    Suspended: { type: Boolean, default: false },
    name: String,
    email: { type: String, unique: true },
    CompanyEmail: { type: String, unique: true, sparse: true },
    password: String,
    role: { type: String, enum: ['superadmin', 'Officestaff', 'Sales Associate', 'Sales Executive',  'Sales Manager', 'Marketing Associate', 'Marketing Executive',  'Marketing Manager', 'Finance Associate', 'Finance Executive',  'Finance Manager', 'HR Associate', 'HR Executive', 'HR Manager', 'Operations Associate', 'Operations Executive', 'Operations Manager', 'Customer Service Associate', 'Customer Service Executive', 'Customer Service Manager', 'IT Associate', 'IT Executive', 'IT Manager' ], default: 'staff' },
    phone: String,
    Address: {
      addressLine1: String,
      landmark: String,
      city: String,
      state: String,
      pincode: String,
      mobileNumber: String,
      alternateNumber: String,
    },
    DOB: Date,
    DOJ: Date,
    Pofileimage: String,
    Designation: String,
    Department: String,
    Location: String,
    onboardedStores: [{
      storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store" },
      commissionAmount: { type: Number, default: 0 },
      isCommissionPaid: { type: Boolean, default: false },
      paidAt: { type: Date },
      onboardedAt: { type: Date, default: Date.now }
    }],
    assignedStores: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store"
    }],
    BankDetails: {
      accountHolderName: String,
      bankName: String,
      accountNumber: String,
      ifscCode: String,
      branch: String,
    },
    UPI: {
      upiId: String,
      upiHolderName: String,
    },
    otp: String,
    otpExpiry: Date,
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.models.SuperAdminStaff || mongoose.model("SuperAdminStaff", userSchema);