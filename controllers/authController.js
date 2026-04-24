import User from "../models/User.js";
import Store from "../models/Store.js";
import generateToken from "../utils/generateToken.js";
import Counter from "../models/Counter.js";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Setup Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// SEND OTP (For Registration & Login)
export const sendOtp = async (req, res) => {
  try {
    const { email, name, isLogin } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Please provide an email address" });
    }

    const normalizedEmail = email.toLowerCase();
    let user = await User.findOne({ email: normalizedEmail });

    // Validate based on whether they are trying to login or register
    if (isLogin && !user) {
      return res.status(404).json({ message: "User not found. Please sign up first." });
    }
    if (!isLogin && user) {
      return res.status(400).json({ message: "User already exists. Please login." });
    }

    // Generate 6 digit OTP and expiration
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // Expires in 10 minutes

    if (!isLogin && !user) {
      if (!name) return res.status(400).json({ message: "Name is required to register." });
      
      const counter = await Counter.findOneAndUpdate(
        { _id: 'userId' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      const userId = `GBUSER${String(counter.seq).padStart(3, '0')}`;
      
      // Create User
      user = await User.create({ userId, name, email: normalizedEmail, otp, otpExpiry });
    } else {
      // Existing user logic
      user.otp = otp;
      user.otpExpiry = otpExpiry;
      await user.save();
    }

    // Send Email
    const mailOptions = {
      from: `"Galibrand Cloud" <${process.env.EMAIL_USER}>`,
      to: normalizedEmail,
      subject: "Your Galibrand Login OTP",
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Hello ${user.name},</h2>
          <p>Your One-Time Password (OTP) to access your Galibrand Dashboard is:</p>
          <h1 style="color: #76b900; letter-spacing: 5px;">${otp}</h1>
          <p>This OTP is valid for 10 minutes. Please do not share it with anyone.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// VERIFY OTP (For Registration & Login)
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required" });

    const normalizedEmail = email.toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user || user.otp !== otp || user.otpExpiry < new Date()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Clear OTP after successful validation
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    const stores = await Store.find({ ownerId: user.userId });

    res.json({
      _id: user._id,
      userId: user.userId,
      name: user.name,
      email: user.email,
      user: { stores },
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};