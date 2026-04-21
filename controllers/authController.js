import User from "../models/User.js";
import Store from "../models/Store.js";
import generateToken from "../utils/generateToken.js";
import Counter from "../models/Counter.js";

// REGISTER USER + CREATE STORE
export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1. Validation to prevent crashes on undefined
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Please provide all required fields" });
    }

    const normalizedEmail = email.toLowerCase();

    // 2. Check if user already exists
    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Safely generate custom User ID using an atomic counter to prevent race conditions
    const counter = await Counter.findOneAndUpdate(
      { _id: 'userId' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const userId = `GBUSER${String(counter.seq).padStart(3, '0')}`;

    // Create user
    const user = await User.create({ userId, name, email: normalizedEmail, password });

    res.status(201).json({
      _id: user._id,
      userId: user.userId,
      name: user.name,
      email: user.email,
      user: { stores: [] }, // Return empty stores array for dashboard
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// LOGIN USER
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Please provide email and password" });
    }

    const normalizedEmail = email.toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });

    if (user && (await user.matchPassword(password))) {
      // Find all stores owned by this user
      const stores = await Store.find({ ownerId: user.userId });

      res.json({
        _id: user._id,
        userId: user.userId,
        name: user.name,
        email: user.email,
        user: { stores }, // Return array of stores for the dashboard
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};