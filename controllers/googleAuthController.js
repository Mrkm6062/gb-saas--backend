import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import Store from "../models/Store.js";
import Counter from "../models/Counter.js";
import generateToken from "../utils/generateToken.js";

// Initialize OAuth2 client
const client = new OAuth2Client();

// GET GOOGLE CONFIG
export const getGoogleConfig = async (req, res) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ message: "Google Client ID is not configured on the server." });
    }
    res.json({ clientId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST GOOGLE LOGIN/REGISTER
export const googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ message: "Google ID Token (credential) is required." });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ message: "Google Client ID is not configured on the server." });
    }

    // Verify token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(400).json({ message: "Invalid token payload." });
    }

    const { sub: googleUserId, email, name, picture, email_verified } = payload;

    if (!email_verified) {
      return res.status(400).json({ message: "Google account email is not verified." });
    }

    const normalizedEmail = email.toLowerCase();

    // Look up User (Store Owner)
    let user = await User.findOne({ email: normalizedEmail });

    if (user) {
      // User exists - Login
      let modified = false;
      if (!user.googleId) {
        user.googleId = googleUserId;
        modified = true;
      }
      if (picture && !user.avatar) {
        user.avatar = picture;
        modified = true;
      }
      if (user.provider !== "google") {
        user.provider = "google";
        modified = true;
      }
      if (modified) {
        await user.save();
      }
    } else {
      // User does not exist - Register (self-registration)
      const counter = await Counter.findOneAndUpdate(
        { _id: 'userId' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      const userId = `GBUSER${String(counter.seq).padStart(3, '0')}`;

      user = await User.create({
        userId,
        name: name || "Store Owner",
        email: normalizedEmail,
        googleId: googleUserId,
        avatar: picture || "",
        provider: "google",
      });
    }

    // Fetch associated stores
    const stores = await Store.find({ ownerId: user.userId });

    res.json({
      _id: user._id,
      userId: user.userId,
      name: user.name,
      email: user.email,
      avatar: user.avatar || "",
      user: { stores },
      token: generateToken(user._id),
    });

  } catch (error) {
    res.status(400).json({ message: `Google verification failed: ${error.message}` });
  }
};
