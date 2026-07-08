import mongoose from "mongoose";

const profileSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      unique: true
    },
    fullName: {
      type: String,
      required: true
    },
    dob: {
      type: Date
    },
    mobile: {
      type: String
    },
    email: {
      type: String
    },
    businessAddress: {
      type: String
    },
    gstNumber: {
      type: String
    },
    panNumber: {
      type: String
    },
    cinNumber: {
      type: String
    },
    profilePicture: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

const Profile = mongoose.model("Profile", profileSchema);
export default Profile;
