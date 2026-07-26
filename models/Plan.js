import mongoose from "mongoose";

const billingSchema = new mongoose.Schema(
  {
    durationMonths: {
      type: Number,
      required: true,
      enum: [1, 6, 12],
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    discountEnabled: {
      type: Boolean,
      default: false,
    },

    discountType: {
      type: String,
      enum: ["percentage"],
      default: "percentage",
    },

    discountValue: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    }
  },
  {
    _id: false,
  }
);

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    active: {
      type: Boolean,
      default: true,
    },

    popular: {
      type: Boolean,
      default: false,
    },

    billing: [billingSchema],

    limits: {
      maxProducts: {
        type: Number,
        default: 20,
      },

      storageLimit: {
        type: Number,
        default: 500, // MB
      },

      storeLimit: {
        type: Number,
        default: 1,
      }
    },

    features: [
      {
        feature: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Feature",
          required: true,
        },

        name: {
          type: String,
          required: true,
        }
      }
    ]
  },
  {
    timestamps: true,
  }
);

planSchema.methods.getBilling = function (months) {
  const bill = this.billing.find(
    x => x.durationMonths === months
  );

  if (!bill) return null;

  const finalPrice = bill.discountEnabled
    ? bill.price - (bill.price * bill.discountValue / 100)
    : bill.price;

  return {
    durationMonths: bill.durationMonths,
    originalPrice: bill.price,
    finalPrice,
    discount: bill.discountValue,
    discountEnabled: bill.discountEnabled
  };
};

export default mongoose.models.Plan ||
mongoose.model("Plan", planSchema);