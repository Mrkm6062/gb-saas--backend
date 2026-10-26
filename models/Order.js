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
    discountDetails: [
      {
        name: String,
        amount: Number,
        type: { type: String }
      }
    ],

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

    deliveryStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      default: null,
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
      default: "placed", // placed / preparing / shipped / delivered / returned / canceled / wasted
    },
    orderSource: {
      type: String,
      default: "web", // web / staff / counter
    },
    orderType: {
      type: String,
      default: "delivery", // Dine-in / delivery
    },
    orderBy: {
      type: String,
      default: "", // if staff then their ID, if counter then counter
    },
    tableNumber: {
      type: String,
      default: "0",
    },
    orderConfirmed: {
      type: Boolean,
      default: false
    },
    preparingAt: {
      type: Date,
      default: null
    },
    shippedAt: {
      type: Date,
      default: null
    },
    deliveredAt: {
      type: Date,
      default: null
    },
    wastedAt: {
      type: Date,
      default: null
    },
    wastedReason: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

export default mongoose.models.Order || mongoose.model("Order", orderSchema);