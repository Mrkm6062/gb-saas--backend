import mongoose from "mongoose";

const customerNoteSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },
    identifier: {
      type: String,
      required: true,
      index: true,
    },
    note: {
      type: String,
      default: "",
    }
  },
  { timestamps: true }
);

customerNoteSchema.index({ storeId: 1, identifier: 1 }, { unique: true });

export default mongoose.models.CustomerNote || mongoose.model("CustomerNote", customerNoteSchema);