import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    store: { type: mongoose.Schema.Types.ObjectId, ref: "Store" },
    name: String,
    price: Number,
    stock: Number,
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);