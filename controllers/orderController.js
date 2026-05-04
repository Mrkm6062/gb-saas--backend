import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Store from "../models/Store.js";
import Coupon from "../models/Coupon.js";
import StoreAlerts from "../models/StoreAlerts.js";
import nodemailer from "nodemailer";

// Internal Helper function to send order confirmation email asynchronously
const sendOrderConfirmationEmail = async (order, store) => {
  if (!order.customerEmail) return;
  try {
    const config = await StoreAlerts.findOne({ storeId: store._id });
    if (!config || !config.isEmailEnabled || !config.emailAddress || !config.appPassword) return;

    const transporter = nodemailer.createTransport({
      host: config.smtpHost, port: config.smtpPort, secure: config.smtpPort === 465,
      auth: { user: config.emailAddress, pass: config.appPassword }
    });

    let subject = `Order Received - ${store.storeName}`;
    let html = '';

    const itemsHtml = order.orderItems.map(item => `<tr><td style="padding:8px; border-bottom:1px solid #ddd;">${item.qty}x ${item.name}</td><td style="padding:8px; border-bottom:1px solid #ddd; text-align:right;">₹${item.price * item.qty}</td></tr>`).join('');
    
    const template = config.templates?.find(t => t.eventType === 'order_placed' && t.isActive);

    if (template) {
      subject = template.subject
        .replace(/{{storeName}}/g, store.storeName)
        .replace(/{{customerName}}/g, order.customerName)
        .replace(/{{orderId}}/g, order._id.toString().slice(-6).toUpperCase());
        
      html = template.body
        .replace(/{{storeName}}/g, store.storeName)
        .replace(/{{customerName}}/g, order.customerName)
        .replace(/{{orderId}}/g, order._id.toString().slice(-6).toUpperCase())
        .replace(/{{orderItems}}/g, `<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">${itemsHtml}</table>`)
        .replace(/{{totalAmount}}/g, order.totalAmount)
        .replace(/{{discountAmount}}/g, order.discountAmount || 0);
    } else {
      html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #76b900;">Order Confirmation</h2>
        <p>Hi ${order.customerName},</p>
        <p>Thank you for shopping with <strong>${store.storeName}</strong>! We have received your order and are currently processing it.</p>
        <h3 style="margin-top: 30px; border-bottom: 2px solid #eee; padding-bottom: 5px;">Order Summary (ID: ${order._id.toString().slice(-6).toUpperCase()})</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">${itemsHtml}</table>
        <p style="text-align: right; font-size: 16px;"><strong>Total Amount: ₹${order.totalAmount}</strong></p>
        ${order.couponCode ? `<p style="text-align: right; color: green;">Discount Applied: -₹${order.discountAmount} (${order.couponCode})</p>` : ''}
        <p style="margin-top: 30px; color: #777; font-size: 12px; text-align: center;">This is an automated email sent via Galibrand Cloud.</p>
      </div>
      `;
    }
    await transporter.sendMail({ from: `"${store.storeName}" <${config.emailAddress}>`, to: order.customerEmail, subject, html });
  } catch (err) {
    console.error("Failed to send order email:", err.message);
  }
};

// Internal Helper function to send order status update emails asynchronously
const sendStatusUpdateEmail = async (order, store, status) => {
  if (!order.customerEmail) return;
  try {
    const config = await StoreAlerts.findOne({ storeId: store._id });
    if (!config || !config.isEmailEnabled || !config.emailAddress || !config.appPassword) return;

    const eventTypeMap = { shipped: 'order_shipped', delivered: 'order_delivered', canceled: 'order_canceled', returned: 'order_returned' };
    const eventType = eventTypeMap[status];
    if (!eventType) return; // Ignore if status change has no mapped template event

    const template = config.templates?.find(t => t.eventType === eventType && t.isActive);
    if (!template) return; // Don't send unless they setup a custom template for this event

    const transporter = nodemailer.createTransport({
      host: config.smtpHost, port: config.smtpPort, secure: config.smtpPort === 465,
      auth: { user: config.emailAddress, pass: config.appPassword }
    });

    const itemsHtml = order.orderItems.map(item => `<tr><td style="padding:8px; border-bottom:1px solid #ddd;">${item.qty}x ${item.name}</td><td style="padding:8px; border-bottom:1px solid #ddd; text-align:right;">₹${item.price * item.qty}</td></tr>`).join('');
    
    const subject = template.subject.replace(/{{storeName}}/g, store.storeName).replace(/{{customerName}}/g, order.customerName).replace(/{{orderId}}/g, order._id.toString().slice(-6).toUpperCase());
    const html = template.body
      .replace(/{{storeName}}/g, store.storeName)
      .replace(/{{customerName}}/g, order.customerName)
      .replace(/{{orderId}}/g, order._id.toString().slice(-6).toUpperCase())
      .replace(/{{orderItems}}/g, `<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">${itemsHtml}</table>`)
      .replace(/{{totalAmount}}/g, order.totalAmount)
      .replace(/{{discountAmount}}/g, order.discountAmount || 0);

    await transporter.sendMail({ from: `"${store.storeName}" <${config.emailAddress}>`, to: order.customerEmail, subject, html });
  } catch (err) {
    console.error(`Failed to send ${status} email:`, err.message);
  }
};

// ✅ CREATE ORDER (PUBLIC - FROM STORE FRONT)
export const createOrder = async (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      address,
      orderItems,
      totalAmount,
      couponCode,
      discountAmount
    } = req.body;

    if (!req.store) {
      return res.status(400).json({ message: "Store context missing. Make sure you are ordering from a valid store domain." });
    }

    const store = req.store;

    const order = await Order.create({
      store: store._id,
      customerName,
      customerEmail,
      customerPhone,
      address,
      orderItems,
      totalAmount,
      couponCode,
      discountAmount,
      paymentStatus: "pending",
      orderStatus: "placed"
    });

    // Deduct stock for each ordered item
    for (const item of orderItems) {
      if (item.variantId) {
        // Deduct from specific variant AND total stock
        await Product.updateOne(
          { _id: item.product, "variants._id": item.variantId },
          {
            $inc: {
              "variants.$.stock": -item.qty,
              totalStock: -item.qty
            }
          }
        );
      } else {
        // Deduct only from total stock (no variants)
        await Product.updateOne(
          { _id: item.product },
          { $inc: { totalStock: -item.qty } }
        );
      }
    }

    // Increment the coupon usage count if a coupon was used
    if (couponCode) {
      await Coupon.updateOne({ storeId: store._id, code: couponCode }, { $inc: { usageCount: 1 } });
    }

    // Fire and forget email notification
    sendOrderConfirmationEmail(order, store).catch(console.error);

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ GET ORDERS (DASHBOARD)
export const getOrders = async (req, res) => {
  try {
    const { storeId } = req.query;

    // Security: Ensure the user owns this store
    const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
    if (!store) {
      return res.status(403).json({ message: "Not authorized to view these orders" });
    }

    const orders = await Order.find({ store: storeId }).sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ UPDATE ORDER STATUS
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderStatus, paymentStatus, resendEmail } = req.body;

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const store = await Store.findOne({ _id: order.store, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized to update this order" });

    const previousStatus = order.orderStatus;

    if (orderStatus) order.orderStatus = orderStatus;
    if (paymentStatus) order.paymentStatus = paymentStatus;

    const updated = await order.save();

    if (orderStatus && orderStatus !== previousStatus) {
      sendStatusUpdateEmail(updated, store, orderStatus).catch(console.error);
    } else if (resendEmail) {
      if (updated.orderStatus === 'placed') {
        sendOrderConfirmationEmail(updated, store).catch(console.error);
      } else {
        sendStatusUpdateEmail(updated, store, updated.orderStatus).catch(console.error);
      }
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ RESEND SPECIFIC ORDER EMAIL (MANUAL TRIGGER)
export const resendOrderEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { emailType } = req.body; // e.g., 'placed', 'shipped', 'delivered', 'canceled', 'returned'

    if (!emailType) {
      return res.status(400).json({ message: "emailType is required." });
    }

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const store = await Store.findOne({ _id: order.store, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized to access this order" });

    if (emailType === 'placed') {
      await sendOrderConfirmationEmail(order, store);
    } else {
      await sendStatusUpdateEmail(order, store, emailType);
    }

    res.json({ message: `Email alert for '${emailType}' triggered successfully.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};