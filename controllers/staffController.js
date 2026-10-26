import Staff from "../models/Staff.js";
import Store from "../models/Store.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import StoreAlerts from "../models/StoreAlerts.js";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { sendStaffLoginOtpEmail } from "../services/landingEmailService.js";

// Helper: Generate JWT for staff
const generateStaffToken = (staff, store) => {
  return jwt.sign(
    {
      staffId: staff._id,
      code: staff.staffId,
      name: staff.name,
      role: staff.role,
      storeId: store._id,
      storeCode: store.storeId,
    },
    process.env.JWT_SECRET || "fallback_secret_key",
    { expiresIn: "7d" }
  );
};

// Helper: Safely find store for owner / superadmin
const findStoreForOwner = async (storeId, user) => {
  if (!storeId || !user) return null;
  const cleanStoreId = String(storeId).trim();
  const isMongoId = /^[0-9a-fA-F]{24}$/.test(cleanStoreId);
  const conditions = [{ storeId: cleanStoreId }];
  if (isMongoId) {
    conditions.push({ _id: cleanStoreId });
  }

  const query = { $or: conditions };
  if (user.role !== "superadmin") {
    const possibleOwnerIds = [user.userId, user._id?.toString(), String(user._id)].filter(Boolean);
    query.ownerId = { $in: possibleOwnerIds };
  }

  return await Store.findOne(query);
};

// Helper: Verify authorization for a specific staff record
const isAuthorizedForStaff = (staff, user) => {
  if (!staff || !user) return false;
  if (user.role === "superadmin") return true;
  const storeOwnerId = String(staff.store?.ownerId || staff.store || "");
  const possibleOwnerIds = [user.userId, user._id?.toString(), String(user._id)].filter(Boolean).map(String);
  return possibleOwnerIds.includes(storeOwnerId);
};

// 1. CREATE STAFF (Store Owner)
export const createStaff = async (req, res) => {
  try {
    const { storeId, name, staffId, password, phone, email, role } = req.body;

    if (!storeId || !name || !staffId || !password) {
      return res.status(400).json({ message: "Store ID, Name, Staff ID, and Password are required." });
    }

    // Verify store ownership (store owner or superadmin)
    const store = await findStoreForOwner(storeId, req.user);
    if (!store) {
      return res.status(403).json({ message: "Store not found or unauthorized access." });
    }

    const cleanStaffId = String(staffId).trim().toUpperCase();

    // Check if staff ID already exists for this store
    const existing = await Staff.findOne({ store: store._id, staffId: cleanStaffId });
    if (existing) {
      return res.status(400).json({ message: `Staff ID '${cleanStaffId}' already exists in this store.` });
    }

    const staff = await Staff.create({
      store: store._id,
      name: name.trim(),
      staffId: cleanStaffId,
      password,
      phone: phone ? phone.trim() : "",
      email: email ? email.trim() : "",
      role: role || "counter",
      status: "active",
    });

    res.status(201).json({
      message: "Staff created successfully!",
      staff: {
        _id: staff._id,
        name: staff.name,
        staffId: staff.staffId,
        phone: staff.phone,
        email: staff.email,
        role: staff.role,
        status: staff.status,
        createdAt: staff.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 2. GET STAFF LIST (Store Owner)
export const getStaffByStore = async (req, res) => {
  try {
    const { storeId } = req.query;

    if (!storeId) {
      return res.status(400).json({ message: "storeId query parameter is required." });
    }

    const store = await findStoreForOwner(storeId, req.user);
    if (!store) {
      return res.status(403).json({ message: "Store not found or unauthorized access." });
    }

    const staffList = await Staff.find({ store: store._id })
      .select("-password")
      .sort({ createdAt: -1 });

    res.json(staffList);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3. UPDATE STAFF (Store Owner)
export const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, role, status, password } = req.body;

    const staff = await Staff.findById(id).populate("store");
    if (!staff) {
      return res.status(404).json({ message: "Staff member not found." });
    }

    // Verify ownership of the store
    if (!isAuthorizedForStaff(staff, req.user)) {
      return res.status(403).json({ message: "Unauthorized to update staff for this store." });
    }

    if (name) staff.name = name.trim();
    if (phone !== undefined) staff.phone = phone.trim();
    if (email !== undefined) staff.email = email.trim();
    if (role) staff.role = role;
    if (status) staff.status = status;
    if (password && String(password).trim().length > 0) {
      staff.password = password; // pre-save hook will hash
    }

    await staff.save();

    res.json({
      message: "Staff updated successfully!",
      staff: {
        _id: staff._id,
        name: staff.name,
        staffId: staff.staffId,
        phone: staff.phone,
        email: staff.email,
        role: staff.role,
        status: staff.status,
        lastLogin: staff.lastLogin,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 4. DELETE STAFF (Store Owner)
export const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;

    const staff = await Staff.findById(id).populate("store");
    if (!staff) {
      return res.status(404).json({ message: "Staff member not found." });
    }

    if (!isAuthorizedForStaff(staff, req.user)) {
      return res.status(403).json({ message: "Unauthorized to delete staff for this store." });
    }

    await Staff.findByIdAndDelete(id);
    res.json({ message: "Staff member deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 5. STAFF LOGIN (For Counter POS)
export const loginStaff = async (req, res) => {
  try {
    const { staffId, password, storeCode } = req.body;

    if (!staffId || !password) {
      return res.status(400).json({ message: "Staff ID and password are required." });
    }

    const cleanStaffId = String(staffId).trim().toUpperCase();

    let query = { staffId: cleanStaffId };

    if (storeCode && String(storeCode).trim() !== "") {
      const cleanStoreCode = String(storeCode).trim();
      const isMongoId = /^[0-9a-fA-F]{24}$/.test(cleanStoreCode);
      const orConditions = [
        { storeId: cleanStoreCode },
        { subdomain: cleanStoreCode.toLowerCase() },
      ];
      if (isMongoId) {
        orConditions.push({ _id: cleanStoreCode });
      }
      const storeMatch = await Store.findOne({ $or: orConditions });

      if (storeMatch) {
        query.store = storeMatch._id;
      }
    }

    const staff = await Staff.findOne(query).populate("store");
    if (!staff) {
      return res.status(401).json({ message: "Invalid Staff ID or Password." });
    }

    if (staff.status === "inactive") {
      return res.status(403).json({ message: "This staff account is deactivated. Contact store administrator." });
    }

    const isMatch = await staff.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid Staff ID or Password." });
    }

    // Update last login timestamp
    staff.lastLogin = new Date();
    await staff.save();

    const store = staff.store;
    const token = generateStaffToken(staff, store);

    res.json({
      message: "Login successful!",
      token,
      staff: {
        _id: staff._id,
        name: staff.name,
        staffId: staff.staffId,
        role: staff.role,
        phone: staff.phone,
        email: staff.email,
        store: {
          _id: store._id,
          storeId: store.storeId,
          storeName: store.storeName,
          logo: store.logo,
          locationAddress: store.locationAddress,
          tables: store.tables || ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
          isRestaurant: store.isRestaurant,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 5.1 SEND STAFF LOGIN OTP (Store ID + Staff Email via LandingMailConfig)
export const sendStaffLoginOtp = async (req, res) => {
  try {
    const { storeId, email } = req.body;

    if (!storeId || !email) {
      return res.status(400).json({ message: "Store ID and Staff Email are required." });
    }

    const cleanStoreId = String(storeId).trim();
    const cleanEmail = String(email).trim().toLowerCase();

    // Resolve store by storeId, storeSlug, subdomain, or _id
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(cleanStoreId);
    const storeConditions = [
      { storeId: cleanStoreId },
      { storeSlug: cleanStoreId.toLowerCase() },
      { subdomain: cleanStoreId.toLowerCase() }
    ];
    if (isMongoId) storeConditions.push({ _id: cleanStoreId });

    const store = await Store.findOne({ $or: storeConditions });
    if (!store) {
      return res.status(404).json({ message: "Store not found. Please verify your Store ID." });
    }

    // Find staff member with this email in this store
    const staff = await Staff.findOne({
      store: store._id,
      email: { $regex: new RegExp(`^${cleanEmail}$`, "i") }
    });

    if (!staff) {
      return res.status(404).json({
        message: `No staff member registered with email "${cleanEmail}" in store ${store.storeId || store.storeName}.`
      });
    }

    if (staff.status === "inactive") {
      return res.status(403).json({ message: "This staff account is deactivated. Contact store administrator." });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    staff.loginOtp = otp;
    staff.loginOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await staff.save();

    // Send OTP email using landing email service
    await sendStaffLoginOtpEmail({
      toEmail: cleanEmail,
      otp,
      staffName: staff.name,
      storeName: store.storeName,
      storeId: store.storeId || store.storeSlug
    });

    res.json({
      success: true,
      message: `OTP sent successfully to ${cleanEmail}. Please enter the 6-digit code.`
    });
  } catch (error) {
    console.error("sendStaffLoginOtp error:", error);
    res.status(500).json({ message: error.message || "Failed to send OTP email." });
  }
};

// 5.2 VERIFY STAFF LOGIN OTP
export const verifyStaffLoginOtp = async (req, res) => {
  try {
    const { storeId, email, otp } = req.body;

    if (!storeId || !email || !otp) {
      return res.status(400).json({ message: "Store ID, Staff Email, and OTP are required." });
    }

    const cleanStoreId = String(storeId).trim();
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    // Resolve store
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(cleanStoreId);
    const storeConditions = [
      { storeId: cleanStoreId },
      { storeSlug: cleanStoreId.toLowerCase() },
      { subdomain: cleanStoreId.toLowerCase() }
    ];
    if (isMongoId) storeConditions.push({ _id: cleanStoreId });

    const store = await Store.findOne({ $or: storeConditions });
    if (!store) {
      return res.status(404).json({ message: "Store not found." });
    }

    // Find staff
    const staff = await Staff.findOne({
      store: store._id,
      email: { $regex: new RegExp(`^${cleanEmail}$`, "i") }
    }).populate("store");

    if (!staff) {
      return res.status(404).json({ message: "Staff member not found." });
    }

    if (staff.status === "inactive") {
      return res.status(403).json({ message: "This staff account is deactivated." });
    }

    // Verify OTP
    if (!staff.loginOtp || staff.loginOtp !== cleanOtp) {
      return res.status(400).json({ message: "Invalid OTP code entered." });
    }

    if (!staff.loginOtpExpires || new Date() > new Date(staff.loginOtpExpires)) {
      return res.status(400).json({ message: "OTP has expired. Please request a new OTP." });
    }

    // Clear OTP
    staff.loginOtp = null;
    staff.loginOtpExpires = null;
    staff.lastLogin = new Date();
    await staff.save();

    const token = generateStaffToken(staff, store);

    res.json({
      success: true,
      message: "Login successful!",
      token,
      staff: {
        _id: staff._id,
        name: staff.name,
        staffId: staff.staffId,
        role: staff.role,
        phone: staff.phone,
        email: staff.email,
        store: {
          _id: store._id,
          storeId: store.storeId,
          storeName: store.storeName,
          storeSlug: store.storeSlug,
          logo: store.logo,
          locationAddress: store.locationAddress,
          tables: store.tables || ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
          isRestaurant: store.isRestaurant,
        },
      },
    });
  } catch (error) {
    console.error("verifyStaffLoginOtp error:", error);
    res.status(500).json({ message: error.message || "Failed to verify OTP." });
  }
};

// 6. SEND DIGITAL BILL EMAIL
export const sendDigitalBillEmail = async (req, res) => {
  try {
    const { orderId, customerEmail } = req.body;

    if (!orderId || !customerEmail) {
      return res.status(400).json({ message: "orderId and customerEmail are required." });
    }

    const order = await Order.findById(orderId).populate("store");
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    const store = order.store;
    const config = await StoreAlerts.findOne({ storeId: store._id });

    if (!config || !config.isEmailEnabled || !config.emailAddress || !config.appPassword) {
      return res.status(400).json({
        message: "Email alerts are not configured for this store. Please configure SMTP email settings in Store Settings > Alerts & Emails.",
      });
    }

    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: { user: config.emailAddress, pass: config.appPassword },
    });

    const itemsRows = order.orderItems
      .map(
        (item) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-size: 14px; color: #333;">
            <strong>${item.name}</strong>
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center; font-size: 14px; color: #555;">
            ${item.qty}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-size: 14px; color: #555;">
            ₹${item.price}
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-size: 14px; font-weight: bold; color: #111;">
            ₹${item.price * item.qty}
          </td>
        </tr>
      `
      )
      .join("");

    const orderNumber = order._id.toString().slice(-6).toUpperCase();
    const orderDate = new Date(order.createdAt).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice #${orderNumber}</title>
      </head>
      <body style="font-family: Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 16px rgba(0,0,0,0.05);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #1e293b, #0f172a); color: #ffffff; padding: 25px 30px; text-align: center;">
            ${store.logo ? `<img src="${store.logo}" alt="${store.storeName}" style="max-height: 50px; margin-bottom: 10px; border-radius: 8px;">` : ""}
            <h1 style="margin: 0; font-size: 22px; font-weight: bold; letter-spacing: 0.5px;">${store.storeName}</h1>
            <p style="margin: 5px 0 0; font-size: 12px; color: #94a3b8;">${store.locationAddress || "Thank you for dining with us!"}</p>
          </div>

          <!-- Receipt Details -->
          <div style="padding: 25px 30px;">
            <div style="display: flex; justify-content: space-between; border-bottom: 2px dashed #e2e8f0; padding-bottom: 15px; margin-bottom: 20px;">
              <div>
                <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: bold; text-transform: uppercase;">Invoice To</p>
                <p style="margin: 4px 0 0; font-size: 15px; font-weight: bold; color: #1e293b;">${order.customerName || "Walk-in Guest"}</p>
                ${order.customerPhone ? `<p style="margin: 2px 0 0; font-size: 12px; color: #64748b;">Phone: ${order.customerPhone}</p>` : ""}
              </div>
              <div style="text-align: right;">
                <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: bold; text-transform: uppercase;">Receipt No</p>
                <p style="margin: 4px 0 0; font-size: 16px; font-weight: 800; color: #0284c7;">#${orderNumber}</p>
                <p style="margin: 2px 0 0; font-size: 12px; color: #64748b;">${orderDate}</p>
                ${order.tableNumber && order.tableNumber !== "0" ? `<p style="margin: 4px 0 0; font-size: 12px; font-weight: bold; color: #ea580c;">Table ${order.tableNumber}</p>` : ""}
              </div>
            </div>

            <!-- Items Table -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <thead>
                <tr style="background-color: #f1f5f9;">
                  <th style="padding: 10px; text-align: left; font-size: 12px; font-weight: bold; color: #475569; text-transform: uppercase;">Item</th>
                  <th style="padding: 10px; text-align: center; font-size: 12px; font-weight: bold; color: #475569; text-transform: uppercase;">Qty</th>
                  <th style="padding: 10px; text-align: right; font-size: 12px; font-weight: bold; color: #475569; text-transform: uppercase;">Price</th>
                  <th style="padding: 10px; text-align: right; font-size: 12px; font-weight: bold; color: #475569; text-transform: uppercase;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
            </table>

            <!-- Summary Totals -->
            <div style="width: 100%; border-top: 2px solid #e2e8f0; padding-top: 15px;">
              <table style="width: 100%; font-size: 14px;">
                ${order.discountAmount > 0 ? `
                  <tr>
                    <td style="padding: 4px 0; color: #64748b;">Discount (${order.couponCode ? `Coupon: ${order.couponCode}` : 'Special Offer'}):</td>
                    <td style="padding: 4px 0; text-align: right; color: #16a34a; font-weight: bold;">-₹${order.discountAmount}</td>
                  </tr>
                ` : ""}
                <tr>
                  <td style="padding: 8px 0; font-size: 18px; font-weight: bold; color: #0f172a;">Grand Total:</td>
                  <td style="padding: 8px 0; font-size: 20px; font-weight: 800; text-align: right; color: #16a34a;">₹${order.totalAmount}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 12px; color: #64748b;">Payment Mode:</td>
                  <td style="padding: 4px 0; font-size: 12px; text-align: right; font-weight: bold; color: #0f172a; text-transform: uppercase;">${order.paymentMethod || "CASH"} (PAID)</td>
                </tr>
                ${order.orderBy ? `
                  <tr>
                    <td style="padding: 4px 0; font-size: 12px; color: #64748b;">Billed By:</td>
                    <td style="padding: 4px 0; font-size: 12px; text-align: right; font-weight: bold; color: #475569;">${order.orderBy}</td>
                  </tr>
                ` : ""}
              </table>
            </div>

            <!-- Footer -->
            <div style="border-top: 1px solid #e2e8f0; margin-top: 25px; padding-top: 20px; text-align: center; color: #94a3b8; font-size: 12px;">
              <p style="margin: 0;">Thank you for your visit! We look forward to serving you again soon.</p>
              <p style="margin: 5px 0 0;">Powered by ${store.storeName}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"${store.storeName}" <${config.emailAddress}>`,
      to: customerEmail.trim(),
      subject: `🧾 Digital Invoice #${orderNumber} from ${store.storeName}`,
      html: emailHtml,
    });

    // Update order with customer email if missing
    if (!order.customerEmail) {
      order.customerEmail = customerEmail.trim();
      await order.save();
    }

    res.json({ success: true, message: `Digital bill invoice sent successfully to ${customerEmail}!` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 7. GET POS CATALOG (Products & Categories for Store Counter)
export const getPosCatalog = async (req, res) => {
  try {
    const { storeId } = req.query;

    if (!storeId) {
      return res.status(400).json({ message: "storeId query parameter is required." });
    }

    const cleanStoreId = String(storeId).trim();
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(cleanStoreId);
    const conditions = [{ storeId: cleanStoreId }];
    if (isMongoId) {
      conditions.push({ _id: cleanStoreId });
    }

    const store = await Store.findOne({ $or: conditions });
    if (!store) {
      return res.status(404).json({ message: "Store not found." });
    }

    // Fetch products belonging to this store
    const products = await Product.find({
      storeId: store._id,
      isActive: { $ne: false },
    })
      .sort({ createdAt: -1 })
      .lean();

    // Fetch categories belonging to this store
    const categories = await Category.find({
      store: store._id,
      status: { $ne: "inactive" },
    })
      .sort({ order: 1, name: 1 })
      .lean();

    const categoryMap = {};
    categories.forEach((c) => {
      categoryMap[c._id.toString()] = c.name;
    });

    const formattedProducts = products.map((p) => {
      const displayPrice = Number(p.price) || Number(p.basePrice) || (p.variants && p.variants[0]?.price) || 0;
      let imgList = [];
      if (Array.isArray(p.images) && p.images.length > 0) {
        imgList = p.images;
      } else if (p.variants && p.variants.length > 0) {
        for (const v of p.variants) {
          if (Array.isArray(v.images) && v.images.length > 0) {
            imgList = v.images.map((img) => (typeof img === "object" ? img.url : img)).filter(Boolean);
            if (imgList.length > 0) break;
          }
        }
      }

      let catName = "";
      if (p.category) {
        catName = categoryMap[p.category.toString()] || p.category;
      }

      return {
        ...p,
        price: displayPrice,
        images: imgList,
        categoryName: catName,
      };
    });

    res.json({
      success: true,
      store: {
        _id: store._id,
        storeId: store.storeId,
        storeName: store.storeName,
        logo: store.logo,
        tables: store.tables || ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
        isRestaurant: store.isRestaurant,
      },
      products: formattedProducts,
      categories,
    });
  } catch (error) {
    console.error("Error fetching POS catalog:", error);
    res.status(500).json({ message: error.message });
  }
};

// 8. STAFF AUTHENTICATION MIDDLEWARE
export const protectStaff = async (req, res, next) => {
  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Staff authorization token required." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret_key");
    const staff = await Staff.findById(decoded.staffId).populate("store");
    if (!staff) {
      return res.status(401).json({ message: "Staff member not found." });
    }
    if (staff.status === "inactive") {
      return res.status(403).json({ message: "This staff account is deactivated." });
    }

    req.staff = staff;
    req.staffStore = staff.store;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired staff token." });
  }
};

// 9. GET ORDERS FOR LOGGED-IN STAFF (Role-based filtering)
export const getStaffOrders = async (req, res) => {
  try {
    const staff = req.staff;
    const store = staff.store;
    let query = { store: store._id };

    if (staff.role === "delivery") {
      // Delivery staff can ONLY see shipped orders assigned to them!
      query.orderStatus = "shipped";
      query.$or = [
        { deliveryStaff: staff._id },
        { DeliveryPersonName: { $regex: new RegExp("^" + staff.name.trim() + "$", "i") } },
        ...(staff.phone ? [{ DeliveryPersonPhone: staff.phone.trim() }] : [])
      ];
    } else if (staff.role === "kitchen") {
      // Kitchen area receives placed, preparing, and wasted orders
      query.orderStatus = { $in: ["placed", "preparing", "wasted"] };
    }

    const orders = await Order.find(query)
      .populate("orderItems.product", "images")
      .populate("deliveryStaff", "name phone staffId")
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      role: staff.role,
      staffName: staff.name,
      orders
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 10. UPDATE ORDER STATUS BY STAFF
export const updateStaffOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderStatus, wastedReason, deliveryStaffId, DeliveryPersonName, DeliveryPersonPhone } = req.body;
    const staff = req.staff;

    const order = await Order.findOne({ _id: id, store: staff.store._id });
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (staff.role === "delivery") {
      // Delivery person can only complete their assigned orders
      const isAssigned = (order.deliveryStaff && String(order.deliveryStaff) === String(staff._id)) ||
        (order.DeliveryPersonName && order.DeliveryPersonName.toLowerCase() === staff.name.toLowerCase()) ||
        (staff.phone && order.DeliveryPersonPhone === staff.phone);

      if (!isAssigned) {
        return res.status(403).json({ message: "You are only authorized to update orders assigned to you." });
      }

      if (orderStatus === "delivered") {
        order.orderStatus = "delivered";
        order.deliveredAt = new Date();
        order.paymentStatus = "paid";
      }
      if (req.body.paymentMethod) order.paymentMethod = req.body.paymentMethod;
      if (req.body.paymentStatus) order.paymentStatus = req.body.paymentStatus;
      if (req.body.paymentId) order.paymentId = req.body.paymentId;
    } else if (staff.role === "kitchen") {
      // Kitchen actions: 'preparing', 'wasted', or 'finish'
      if (orderStatus === "preparing") {
        order.orderStatus = "preparing";
        order.preparingAt = new Date();
      } else if (orderStatus === "wasted") {
        order.orderStatus = "wasted";
        order.wastedAt = new Date();
        if (wastedReason) order.wastedReason = wastedReason;
      } else if (orderStatus === "finish" || orderStatus === "delivered" || orderStatus === "shipped") {
        const isDineIn = order.orderType && order.orderType.toLowerCase() === "dine-in";
        if (isDineIn) {
          order.orderStatus = "delivered";
          order.deliveredAt = new Date();
        } else {
          order.orderStatus = "shipped";
          order.shippedAt = new Date();
          if (deliveryStaffId) order.deliveryStaff = deliveryStaffId;
          if (DeliveryPersonName) order.DeliveryPersonName = DeliveryPersonName;
          if (DeliveryPersonPhone) order.DeliveryPersonPhone = DeliveryPersonPhone;
        }
      }
    } else {
      // Counter, Cashier, Manager
      if (orderStatus) order.orderStatus = orderStatus;
      if (orderStatus === "delivered") {
        order.deliveredAt = new Date();
        order.paymentStatus = "paid";
      }
      if (orderStatus === "preparing") order.preparingAt = new Date();
      if (orderStatus === "shipped") order.shippedAt = new Date();
      if (orderStatus === "wasted") {
        order.wastedAt = new Date();
        if (wastedReason) order.wastedReason = wastedReason;
      }
      if (deliveryStaffId) order.deliveryStaff = deliveryStaffId;
      if (DeliveryPersonName) order.DeliveryPersonName = DeliveryPersonName;
      if (DeliveryPersonPhone) order.DeliveryPersonPhone = DeliveryPersonPhone;
    }

    const updated = await order.save();
    res.json({ success: true, message: "Order updated successfully!", order: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 11. GET KITCHEN ORDERS (For ManageCounter and KDS Display)
export const getKitchenOrders = async (req, res) => {
  try {
    const { storeId } = req.query;
    if (!storeId) {
      return res.status(400).json({ message: "storeId query parameter is required." });
    }

    const cleanStoreId = String(storeId).trim();
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(cleanStoreId);
    const conditions = [{ storeId: cleanStoreId }];
    if (isMongoId) {
      conditions.push({ _id: cleanStoreId });
    }

    const store = await Store.findOne({ $or: conditions });
    if (!store) {
      return res.status(404).json({ message: "Store not found." });
    }

    // Orders active in kitchen (placed, preparing) + recently wasted
    const orders = await Order.find({
      store: store._id,
      orderStatus: { $in: ["placed", "preparing", "wasted"] }
    })
      .populate("orderItems.product", "images")
      .populate("deliveryStaff", "name phone staffId")
      .sort({ createdAt: -1 })
      .limit(60);

    res.json({ success: true, orders, storeName: store.storeName });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 12. FINISH KITCHEN ORDER (Dine-in -> delivered, Delivery -> shipped)
export const finishKitchenOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { deliveryStaffId, DeliveryPersonName, DeliveryPersonPhone } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    const isDineIn = order.orderType && order.orderType.toLowerCase() === "dine-in";

    if (isDineIn) {
      order.orderStatus = "delivered";
      order.deliveredAt = new Date();
    } else {
      order.orderStatus = "shipped";
      order.shippedAt = new Date();
      if (deliveryStaffId) order.deliveryStaff = deliveryStaffId;
      if (DeliveryPersonName) order.DeliveryPersonName = DeliveryPersonName;
      if (DeliveryPersonPhone) order.DeliveryPersonPhone = DeliveryPersonPhone;
    }

    await order.save();
    res.json({
      success: true,
      message: isDineIn ? "Dine-in order served and marked Delivered!" : "Delivery order finished and marked Shipped!",
      order
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 13. UPDATE KITCHEN ORDER STATUS (preparing, wasted)
export const updateKitchenOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderStatus, wastedReason } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (orderStatus === "preparing") {
      order.orderStatus = "preparing";
      order.preparingAt = new Date();
    } else if (orderStatus === "wasted") {
      order.orderStatus = "wasted";
      order.wastedAt = new Date();
      if (wastedReason) order.wastedReason = wastedReason;
    }

    await order.save();
    res.json({ success: true, message: `Order status updated to ${orderStatus}`, order });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 14. GET ACTIVE DELIVERY STAFF LIST (For Assigning Shipped Orders)
export const getStoreDeliveryStaff = async (req, res) => {
  try {
    const { storeId } = req.query;
    if (!storeId) {
      return res.status(400).json({ message: "storeId query parameter is required." });
    }

    const cleanStoreId = String(storeId).trim();
    const isMongoId = /^[0-9a-fA-F]{24}$/.test(cleanStoreId);
    const conditions = [{ storeId: cleanStoreId }];
    if (isMongoId) {
      conditions.push({ _id: cleanStoreId });
    }

    const store = await Store.findOne({ $or: conditions });
    if (!store) {
      return res.status(404).json({ message: "Store not found." });
    }

    const staffList = await Staff.find({
      store: store._id,
      role: "delivery",
      status: "active"
    }).select("_id name staffId phone email status");

    res.json({ success: true, deliveryStaff: staffList });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
