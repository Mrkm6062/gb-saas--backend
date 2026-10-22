import mongoose from "mongoose";

const landingContactSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    subject: {
      type: String,
      trim: true,
      default: "",
    },
    shopName: {
      type: String,
      trim: true,
      default: "",
    },
    message: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["new", "read", "responded", "archived"],
      default: "new",
      index: true,
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
    emailError: {
      type: String,
      default: "",
    },
    sentTo: {
      type: [String],
      default: [],
    },
    adminNotes: {
      type: String,
      default: "",
    },
    ipAddress: {
      type: String,
      default: "",
    },
    userAgent: {
      type: String,
      default: "",
    },
    respondedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.models.LandingContact ||
  mongoose.model("LandingContact", landingContactSchema);
