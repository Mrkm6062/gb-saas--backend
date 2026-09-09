import mongoose from "mongoose";

const deliveryAreaSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        "state",
        "district",
        "pincode",
        "postOffice",
        "village",
        "building",
        "chawl",
      ],
      required: true,
      index: true,
    },

    state: {
      type: String,
      default: null,
      index: true,
    },

    district: {
      type: String,
      default: null,
      index: true,
    },

    postOffice: {
      type: String,
      default: null,
      index: true,
    },

    pincode: {
      type: String,
      default: null,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    charge: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    enabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

deliveryAreaSchema.index({
  storeId: 1,
  type: 1,
  pincode: 1,
});

export default mongoose.models.DeliveryArea ||
  mongoose.model("DeliveryArea", deliveryAreaSchema);
