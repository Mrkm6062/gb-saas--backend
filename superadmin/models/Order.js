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
    address: String,

    orderItems: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        name: String,
        price: Number,
        qty: Number,
      },
    ],

    totalAmount: Number,

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

export default mongoose.model("Order", orderSchema);