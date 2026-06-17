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
        customImage: String,
        customText: String,
      },
    ],

    totalAmount: Number,
    couponCode: String,
    discountAmount: { type: Number, default: 0 },

    shippingCharge: {
      type: Number,
      default: 0,
    },

    ShippingMethod: {
      type: String,
      default: "",
    },

    ShippingTrackingNumber: {
      type: String,
      default: "",
    },

    ShippingCompany: {
      type: String,
      default: "",
    },

    DeliveryPersonName: {
      type: String,
      default: "",
    },

    DeliveryPersonPhone: {
      type: String,
      default: "",
    },

    WhasAppOrder: {
      type: Boolean,
      default: false,
    },

    paymentMethod: {
      type: String,
      default: "cod", // cod / razorpay /whatsapp
    },

    paymentStatus: {
      type: String,
      default: "pending", // pending / paid
    },

    orderStatus: {
      type: String,
      default: "placed", // placed / shipped / delivered /returned / cancelled
    },
  },
  { timestamps: true }
);

export default mongoose.models.Order || mongoose.model("Order", orderSchema);