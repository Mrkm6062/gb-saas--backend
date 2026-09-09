import mongoose from "mongoose";

const deliverySettingsSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
      unique: true,
    },

    // How the store controls delivery
    deliveryMode: {
      type: String,
      enum: [
        "all",
        "state",
        "district",
        "pincode",
        "postOffice",
        "locality",
      ],
      default: "all",
    },

    // Existing settings
    allowedStates: [
      {
        type: String,
      },
    ],

    allowedPincodes: [
      {
        type: String,
      },
    ],

    baseCharge: {
      type: Number,
      default: 0,
    },

    freeShippingThreshold: {
      type: Number,
      default: 0,
    },

    // New location-based delivery settings
    deliveryLocations: [
      {
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
        },

        // Reference to location from pincode/location DB
        locationId: {
          type: mongoose.Schema.Types.ObjectId,
          default: null,
        },

        name: {
          type: String,
          required: true,
        },

        pincode: {
          type: String,
          default: null,
        },

        charge: {
          type: Number,
          default: 0,
        },

        enabled: {
          type: Boolean,
          default: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.DeliverySettings ||
  mongoose.model("DeliverySettings", deliverySettingsSchema);