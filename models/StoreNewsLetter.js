import mongoose from "mongoose";

const storeNewsLetterSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  isSubscribed: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Ensure a customer email can only subscribe once per store
storeNewsLetterSchema.index({ storeId: 1, email: 1 }, { unique: true });

export default mongoose.models.StoreNewsLetter || mongoose.model("StoreNewsLetter", storeNewsLetterSchema);