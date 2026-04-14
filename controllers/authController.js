import User from "../models/User.js";
import Store from "../models/Store.js";
import generateToken from "../utils/generateToken.js";

// REGISTER USER + CREATE STORE
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, storeName } = req.body;

    // Check user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Check subdomain availability
    const subdomain = storeName.toLowerCase().replace(/\s+/g, "");
    const storeExists = await Store.findOne({ subdomain });

    if (storeExists) {
      return res.status(400).json({ message: "Store name already taken" });
    }

    // Create user
    const user = await User.create({ name, email, password });

    // Create store
    const store = await Store.create({
      name: storeName,
      subdomain,
      owner: user._id,
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      store: store.subdomain,
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

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      const store = await Store.findOne({ owner: user._id });

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        store: store?.subdomain,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};