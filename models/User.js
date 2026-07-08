import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const userSchema = new mongoose.Schema(
  {
    userId: { type: String, unique: true },
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: { type: String, enum: ['user', 'superadmin'], default: 'user' },
    otp: String,
    otpExpiry: Date,
    googleId: String,
    avatar: String,
    provider: { type: String, default: "email" },
    sessionId: {
      type: String,
      default: null
    },
    sessionCreatedAt: {
      type: Date,
      default: null
    },
    lastLogin: {
      type: Date,
      default: null
    },
    refreshToken: {
      type: String,
      default: null
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.sessionId = crypto.randomUUID();
    this.sessionCreatedAt = new Date();
    this.refreshToken = null;
  }
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.models.User || mongoose.model("User", userSchema);