import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },

    customerName: String,
    customerEmail: String,
    customerPhone: String,
    address: {
      addressLine1: String,
      landmark: String,
      city: String,
      state: String,
      pincode: String,
      mobileNumber: String,
      alternateNumber: String,
    },

    orderItems: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        variantId: String,
        name: String,
        price: Number,
        qty: Number,
      },
    ],

    totalAmount: Number,
    couponCode: String,
    discountAmount: { type: Number, default: 0 },

    paymentStatus: {
      type: String,
      default: "pending", // pending / paid
    },

    orderStatus: {
      type: String,
      default: "placed", // placed / shipped / delivered
    },
  },
  { timestamps: true }
);

export default mongoose.models.Order || mongoose.model("Order", orderSchema);