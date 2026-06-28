import mongoose from "mongoose";

const storeHoursSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
  mode: {
    type: String,
    enum: ["24x7", "custom"],
    default: "24x7"
  },
  timezone: {
    type: String,
    default: "Asia/Kolkata"
  },
  weeklySchedule: [
    {
      day: {
        type: String,
        enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
        required: true
      },
      enabled: {
        type: Boolean,
        default: true
      },
      slots: [
        {
          open: {
            type: String, // HH:mm
            required: true
          },
          close: {
            type: String, // HH:mm
            required: true
          }
        }
      ]
    }
  ],
  holidays: [
    {
      name: String,
      date: Date,
      closed: {
        type: Boolean,
        default: true
      },
      slots: [
        {
          open: String,
          close: String
        }
      ]
    }
  ],
  specialHours: [
    {
      title: String,
      startDate: Date,
      endDate: Date,
      closed: {
        type: Boolean,
        default: false
      },
      slots: [
        {
          open: String,
          close: String
        }
      ]
    }
  ],
  temporaryClosure: {
    enabled: {
      type: Boolean,
      default: false
    },
    reason: String,
    startDate: Date,
    endDate: Date
  },
  displayStoreStatus: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

export default mongoose.models.StoreHours || mongoose.model("StoreHours", storeHoursSchema);