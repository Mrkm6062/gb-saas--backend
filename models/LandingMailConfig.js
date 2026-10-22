import mongoose from "mongoose";

const landingMailConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "global",
      unique: true,
      index: true,
    },
    isEnabled: {
      type: Boolean,
      default: false,
    },
    smtpHost: {
      type: String,
      default: "smtp.gmail.com",
      trim: true,
    },
    smtpPort: {
      type: Number,
      default: 587,
    },
    secure: {
      type: Boolean,
      default: false,
    },
    smtpUser: {
      type: String,
      trim: true,
      default: "",
    },
    smtpPass: {
      type: String,
      default: "",
    },
    fromName: {
      type: String,
      default: "Galibrand Contact Form",
      trim: true,
    },
    fromEmail: {
      type: String,
      trim: true,
      default: "",
    },
    receiverEmails: {
      type: [String],
      default: [],
    },
    subjectPrefix: {
      type: String,
      default: "New Inquiry from Landing Page",
      trim: true,
    },
    lastTestedAt: {
      type: Date,
      default: null,
    },
    lastTestStatus: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.models.LandingMailConfig ||
  mongoose.model("LandingMailConfig", landingMailConfigSchema);
