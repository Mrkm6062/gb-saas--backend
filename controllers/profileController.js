import Profile from "../models/profile.js";
import Store from "../models/Store.js";
import User from "../models/User.js";

// GET PROFILE
export const getProfile = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: "Unauthorized: User context is missing." });
    }

    const store = await Store.findOne({ ownerId: req.user.userId });
    if (!store) {
      return res.status(404).json({ message: "Store not found for this user." });
    }

    let profile = await Profile.findOne({ storeId: store._id });
    if (!profile) {
      const user = await User.findOne({ userId: req.user.userId });
      profile = await Profile.create({
        storeId: store._id,
        fullName: user ? user.name : "Store Owner",
        email: user ? user.email : "",
        mobile: user ? user.mobile || "" : ""
      });
    }

    res.json(profile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE PROFILE
export const updateProfile = async (req, res) => {
  try {
    const { 
      fullName, dob, mobile, email, businessAddress, gstNumber, panNumber, cinNumber, profilePicture 
    } = req.body;

    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: "Unauthorized: User context is missing." });
    }

    const store = await Store.findOne({ ownerId: req.user.userId });
    if (!store) {
      return res.status(404).json({ message: "Store not found for this user." });
    }

    let profile = await Profile.findOne({ storeId: store._id });
    if (!profile) {
      profile = new Profile({ storeId: store._id });
    }

    if (fullName !== undefined) profile.fullName = fullName;
    if (dob !== undefined) profile.dob = dob;
    if (mobile !== undefined) profile.mobile = mobile;
    if (email !== undefined) profile.email = email;
    if (businessAddress !== undefined) profile.businessAddress = businessAddress;
    if (gstNumber !== undefined) profile.gstNumber = gstNumber;
    if (panNumber !== undefined) profile.panNumber = panNumber;
    if (cinNumber !== undefined) profile.cinNumber = cinNumber;
    if (profilePicture !== undefined) profile.profilePicture = profilePicture;

    const updated = await profile.save();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
