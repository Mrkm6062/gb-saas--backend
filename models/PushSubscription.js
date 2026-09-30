import mongoose from "mongoose";

const pushSubscriptionSchema = new mongoose.Schema(
  {
    storeId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      default: null,
      index: true,
    },
    endpoint: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    keys: {
      p256dh: {
        type: String,
        required: true,
      },
      auth: {
        type: String,
        required: true,
      },
    },
    userAgent: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Delete cached model if it was compiled with previous ObjectId schema
if (mongoose.models && mongoose.models.PushSubscription) {
  delete mongoose.models.PushSubscription;
}

export default mongoose.model("PushSubscription", pushSubscriptionSchema);
