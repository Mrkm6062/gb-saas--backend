import User from "../models/User.js";
import Store from "../models/Store.js";
import generateToken from "../utils/generateToken.js";
import Counter from "../models/Counter.js";
import SuperAdminStaff from "../models/SuperAdminStaff.js";
import nodemailer from "nodemailer";

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

// LOGIN SUPERADMIN
// LOGIN SUPERADMIN / STAFF
export const loginSuperAdmin = async (req, res) => {
  try {
    const { email, otp, password, loginType } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Please provide an email address" });
    }

    const normalizedEmail = email.toLowerCase();

    // 1. SYSADMIN PASSWORD LOGIN
    if (loginType === 'sysadmin') {
      const user = await User.findOne({ email: normalizedEmail, role: 'superadmin' });
      if (!user) {
        return res.status(401).json({ message: "Not authorized as Superadmin." });
      }
      
      if (await user.matchPassword(password)) {
        return res.json({
          _id: user._id,
          userId: user.userId,
          name: user.name,
          email: user.email,
          role: user.role,
          token: generateToken(user._id),
        });
      } else {
        return res.status(401).json({ message: "Invalid email or password" });
      }
    }

    // 2. EMPLOYEE OTP LOGIN
    let user = await SuperAdminStaff.findOne({ email: normalizedEmail });
    
    if (!user) {
      return res.status(401).json({ message: "Not authorized. Employee email not found." });
    }

    if (user.Suspended) {
      return res.status(403).json({ message: "Your account is suspended. Please contact the administrator." });
    }

    if (!otp) {
      // STEP 1: Send OTP
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      user.otp = generatedOtp;
      user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
      await user.save();

      try {
        if (process.env.SMTP_USER) {
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_PORT == 465,
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS
            }
          });
          
          await transporter.sendMail({
            from: `"Galibrand Cloud" <${process.env.SMTP_USER}>`,
            to: email,
            subject: "Admin Login OTP - Galibrand Cloud",
            html: `<div style="font-family: sans-serif; text-align: center; padding: 20px;"><h2>Your Admin Login OTP</h2><p>Your OTP is: <strong style="font-size: 24px; letter-spacing: 2px;">${generatedOtp}</strong></p><p>It is valid for 10 minutes.</p></div>`
          });
        } else {
          console.log(`[DEBUG - No SMTP Configured] Admin OTP for ${email}: ${generatedOtp}`);
        }
      } catch (emailErr) {
        console.error("Failed to send OTP email:", emailErr);
        console.log(`[DEBUG] Admin OTP for ${email}: ${generatedOtp}`);
      }

      return res.json({ message: "OTP sent successfully", step: "verify" });
    } else {
      // STEP 2: Verify OTP
      if (user.otp !== otp || user.otpExpiry < new Date()) {
        return res.status(400).json({ message: "Invalid or expired OTP" });
      }

      // Clear OTP
      user.otp = undefined;
      user.otpExpiry = undefined;
      await user.save();

      res.json({
        _id: user._id,
        userId: user.userId || user.EmployeeId,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET SUPERADMIN DASHBOARD DATA
export const getDashboardData = async (req, res) => {
  try {
    // Fetch all normal users (excluding passwords) and all stores
    const users = await User.find({ role: 'user' }).select('-password').sort({ createdAt: -1 });
    const stores = await Store.find().sort({ createdAt: -1 });
    
    res.json({ users, stores });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};