import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Store",
    required: true
  },

  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },

  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order"
  },

  customerName: String,

  customerEmail: String,

  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },

  review: String,

  reviewImages: [String],

  isApproved: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

export default mongoose.models.Review || mongoose.model("Review", reviewSchema);