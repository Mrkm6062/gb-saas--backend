import Staff from "../models/Staff.js";
import Store from "../models/Store.js";
import Order from "../models/Order.js";
import StoreAlerts from "../models/StoreAlerts.js";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

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

// 1. CREATE STAFF (Store Owner)
export const createStaff = async (req, res) => {
  try {
    const { storeId, name, staffId, password, phone, email, role } = req.body;

    if (!storeId || !name || !staffId || !password) {
      return res.status(400).json({ message: "Store ID, Name, Staff ID, and Password are required." });
    }

    // Verify store ownership
    const store = await Store.findOne({
      $or: [{ _id: storeId }, { storeId: storeId }],
      ownerId: req.user.userId,
    });

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

    const store = await Store.findOne({
      $or: [{ _id: storeId }, { storeId: storeId }],
      ownerId: req.user.userId,
    });

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
    if (String(staff.store.ownerId) !== String(req.user.userId)) {
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

    if (String(staff.store.ownerId) !== String(req.user.userId)) {
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
      const storeMatch = await Store.findOne({
        $or: [
          { storeId: cleanStoreCode },
          { _id: cleanStoreCode.match(/^[0-9a-fA-F]{24}$/) ? cleanStoreCode : null },
          { subdomain: cleanStoreCode.toLowerCase() },
        ].filter(Boolean),
      });

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
