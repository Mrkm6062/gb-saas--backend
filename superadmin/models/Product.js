import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  image: { type: String },
  storeId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Store", 
    required: true // Ensures product always belongs to a specific store
  }
}, {
  timestamps: true
});

export default mongoose.models.Product || mongoose.model("Product", productSchema);