import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Store from "../models/Store.js";
import Coupon from "../models/Coupon.js";
import StoreAlerts from "../models/StoreAlerts.js";
import DeliverySettings from "../models/DeliverySettings.js";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import CustomerOTP from "../models/CustomerOTP.js";
import CheckoutSettings from "../models/CheckoutSettings.js";
import Razorpay from "razorpay";
import crypto from "crypto";
import { decrypt } from "../utils/crypto.js";
import Domain from "../models/Domain.js";
import { storage } from "../gcs.js";
import { checkIsStoreOpen } from "./storeHoursController.js";

const calculateOfferDiscount = (orderItems, productsInDb) => {
  let totalB1G1Discount = 0;
  
  const productMap = {};
  productsInDb.forEach(p => { productMap[p._id.toString()] = p; });
  
  const offerGroupItems = {}; 
  
  for (const item of orderItems) {
    const dbProduct = productMap[item.product.toString()];
    if (!dbProduct) continue;
    
    const activeOffers = (dbProduct.offerCategories || []).filter(oc => {
      if (!oc.active) return false;
      const now = new Date();
      if (oc.startDate && now < new Date(oc.startDate)) return false;
      if (oc.endDate && now > new Date(oc.endDate)) return false;
      return oc.offerType === 'B1G1' || oc.offerType === 'B2G1';
    });
    
    if (activeOffers.length > 0) {
      const bestOffer = activeOffers.find(oc => oc.offerType === 'B1G1') || activeOffers[0];
      const offerId = bestOffer._id.toString();
      
      if (!offerGroupItems[offerId]) {
        offerGroupItems[offerId] = {
          offerType: bestOffer.offerType,
          prices: []
        };
      }
      
      const itemPrice = item.price;
      for (let i = 0; i < item.qty; i++) {
        offerGroupItems[offerId].prices.push(itemPrice);
      }
    }
  }
  
  for (const offerId in offerGroupItems) {
    const group = offerGroupItems[offerId];
    group.prices.sort((a, b) => b - a);
    
    const count = group.prices.length;
    if (group.offerType === 'B1G1') {
      const freeCount = Math.floor(count / 2);
      if (freeCount > 0) {
        const cheapestItems = group.prices.slice(-freeCount);
        const discount = cheapestItems.reduce((sum, p) => sum + p, 0);
        totalB1G1Discount += discount;
      }
    } else if (group.offerType === 'B2G1') {
      const freeCount = Math.floor(count / 3);
      if (freeCount > 0) {
        const cheapestItems = group.prices.slice(-freeCount);
        const discount = cheapestItems.reduce((sum, p) => sum + p, 0);
        totalB1G1Discount += discount;
      }
    }
  }
  
  return totalB1G1Discount;
};

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

    const itemsHtml = order.orderItems.map(item => {
      const customImgHtml = item.customImage ? `<br><span style="font-size: 11px; color: #666; display: block; margin-top: 4px;">Custom Image:</span><a href="${item.customImage}" target="_blank"><img src="${item.customImage}" style="max-height: 60px; border-radius: 4px; margin-top: 4px; border: 1px solid #eee;" alt="Custom Design"/></a>` : '';
      return `<tr><td style="padding:8px; border-bottom:1px solid #ddd; vertical-align:top;">${item.qty}x ${item.name}${customImgHtml}</td><td style="padding:8px; border-bottom:1px solid #ddd; text-align:right; vertical-align:top;">₹${item.price * item.qty}</td></tr>`;
    }).join('');
    
    const domainRecord = await Domain.findOne({ storeId: store._id, status: 'connected' });
    const storeUrl = domainRecord ? `https://${domainRecord.domain}` : `https://${store.subdomain}`;
    
    const reviewLinksHtml = order.orderItems.map(item => 
      `<div style="margin-bottom: 10px;"><a href="${storeUrl}/review/${order._id}/${item.product?._id || item.product}" style="display: inline-block; background-color: #76b900; color: #ffffff; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">Review ${item.name}</a></div>`
    ).join('');
    
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
        .replace(/{{discountAmount}}/g, order.discountAmount || 0)
        .replace(/{{shippingCharge}}/g, order.shippingCharge || 0)
        .replace(/{{reviewLinks}}/g, reviewLinksHtml);
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
        ${order.shippingCharge > 0 ? `<p style="text-align: right; color: #555;">Shipping Charge: ₹${order.shippingCharge}</p>` : ''}
        <p style="margin-top: 30px; color: #777; font-size: 12px; text-align: center;">This is an automated email sent via <strong>${store.storeName}</strong>.</p>
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

    const itemsHtml = order.orderItems.map(item => {
      const customImgHtml = item.customImage ? `<br><span style="font-size: 11px; color: #666; display: block; margin-top: 4px;">Custom Image:</span><a href="${item.customImage}" target="_blank"><img src="${item.customImage}" style="max-height: 60px; border-radius: 4px; margin-top: 4px; border: 1px solid #eee;" alt="Custom Design"/></a>` : '';
      return `<tr><td style="padding:8px; border-bottom:1px solid #ddd; vertical-align:top;">${item.qty}x ${item.name}${customImgHtml}</td><td style="padding:8px; border-bottom:1px solid #ddd; text-align:right; vertical-align:top;">₹${item.price * item.qty}</td></tr>`;
    }).join('');
    
    const domainRecord = await Domain.findOne({ storeId: store._id, status: 'connected' });
    const storeUrl = domainRecord ? `https://${domainRecord.domain}` : `https://${store.subdomain}`;
    
    const reviewLinksHtml = order.orderItems.map(item => 
      `<div style="margin-bottom: 10px;"><a href="${storeUrl}/review/${order._id}/${item.product?._id || item.product}" style="display: inline-block; background-color: #76b900; color: #ffffff; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">Review ${item.name}</a></div>`
    ).join('');
    
    let trackingDetailsHtml = '';
    if (order.ShippingMethod || order.ShippingTrackingNumber || order.DeliveryPersonName) {
      trackingDetailsHtml = `<div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-top: 20px;">
        <h4 style="margin-top: 0; color: #3b82f6;">Tracking Information</h4>`;
      if (order.ShippingMethod) trackingDetailsHtml += `<p style="margin: 5px 0; font-size: 14px;"><strong>Shipping Method:</strong> ${order.ShippingMethod}</p>`;
      if (order.ShippingCompany) trackingDetailsHtml += `<p style="margin: 5px 0; font-size: 14px;"><strong>Shipping Company:</strong> ${order.ShippingCompany}</p>`;
      if (order.ShippingTrackingNumber) trackingDetailsHtml += `<p style="margin: 5px 0; font-size: 14px;"><strong>Tracking Number:</strong> ${order.ShippingTrackingNumber}</p>`;
      if (order.DeliveryPersonName || order.DeliveryPersonPhone) {
        const name = order.DeliveryPersonName || 'N/A';
        const phone = order.DeliveryPersonPhone ? ` (${order.DeliveryPersonPhone})` : '';
        trackingDetailsHtml += `<p style="margin: 5px 0; font-size: 14px;"><strong>Delivery Person:</strong> ${name}${phone}</p>`;
      }
      trackingDetailsHtml += `</div>`;
    }

    const subject = template.subject.replace(/{{storeName}}/g, store.storeName).replace(/{{customerName}}/g, order.customerName).replace(/{{orderId}}/g, order._id.toString().slice(-6).toUpperCase());
    const html = template.body
      .replace(/{{storeName}}/g, store.storeName)
      .replace(/{{customerName}}/g, order.customerName)
      .replace(/{{orderId}}/g, order._id.toString().slice(-6).toUpperCase())
      .replace(/{{orderItems}}/g, `<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">${itemsHtml}</table>`)
      .replace(/{{totalAmount}}/g, order.totalAmount)
      .replace(/{{discountAmount}}/g, order.discountAmount || 0)
      .replace(/{{shippingCharge}}/g, order.shippingCharge || 0)
      .replace(/{{reviewLinks}}/g, reviewLinksHtml)
      .replace(/{{trackingDetails}}/g, trackingDetailsHtml)
      .replace(/{{ShippingMethod}}/g, order.ShippingMethod || 'N/A')
      .replace(/{{ShippingTrackingNumber}}/g, order.ShippingTrackingNumber || 'N/A')
      .replace(/{{ShippingCompany}}/g, order.ShippingCompany || 'N/A')
      .replace(/{{DeliveryPersonName}}/g, order.DeliveryPersonName || 'N/A')
      .replace(/{{DeliveryPersonPhone}}/g, order.DeliveryPersonPhone || 'N/A');

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
      discountAmount,
      discountType,
      shippingCharge,
      paymentMethod
    } = req.body;

    if (!req.store) {
      return res.status(400).json({ message: "Store context missing. Make sure you are ordering from a valid store domain." });
    }

    const store = req.store;

    const isPlanExpired = store.subscriptionStatus === 'expired' || 
                          (store.planExpiryDate && new Date() > new Date(store.planExpiryDate));

    if (isPlanExpired) {
      return res.status(403).json({ message: "We are temporarily closed and not accepting orders because our store subscription has expired." });
    }

    // Validate if store is open
    const storeOpenStatus = await checkIsStoreOpen(store._id);
    if (!storeOpenStatus.isOpen) {
      return res.status(400).json({ 
        message: storeOpenStatus.reason || "We are currently closed and not accepting orders. Please try again during our store hours." 
      });
    }
    
    // Validate Delivery Rules Securely on the Backend
    const deliverySettings = await DeliverySettings.findOne({ storeId: store._id });
    if (deliverySettings) {
      if (deliverySettings.deliveryMode === 'state') {
        const allowed = deliverySettings.allowedStates.map(s => s.toLowerCase());
        if (!allowed.includes((address.state || '').toLowerCase().trim())) {
          return res.status(400).json({ message: `Sorry, we do not deliver to ${address.state} at the moment.` });
        }
      } else if (deliverySettings.deliveryMode === 'pincode') {
        if (!deliverySettings.allowedPincodes.includes((address.pincode || '').trim())) {
          return res.status(400).json({ message: `Sorry, we do not deliver to pincode ${address.pincode} at the moment.` });
        }
      }
    }

    const productIds = orderItems.map(item => item.product);
    const productsInDb = await Product.find({ _id: { $in: productIds } }).populate('offerCategories');
    const offerDiscount = calculateOfferDiscount(orderItems, productsInDb);

    const calculatedDiscountAmount = (Number(discountAmount) || 0) + offerDiscount;
    const rawSubtotal = orderItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.qty)), 0);
    const calculatedTotalAmount = Math.max(0, rawSubtotal - calculatedDiscountAmount + (Number(shippingCharge) || 0));

    const order = await Order.create({
      store: store._id,
      customerName,
      customerEmail,
      customerPhone,
      address,
      orderItems,
      totalAmount: calculatedTotalAmount,
      couponCode,
      discountAmount: calculatedDiscountAmount,
      discountType: discountType || "",
      shippingCharge,
      paymentMethod: paymentMethod || 'cod',
      WhasAppOrder: paymentMethod === 'whatsapp',
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

    let razorpayOrder = null;
    if (paymentMethod === 'razorpay') {
      try {
        const settings = await CheckoutSettings.findOne({ storeId: store._id });
        if (!settings || !settings.razorpayEnabled || !settings.razorpayKeyId || !settings.razorpayKeySecret) {
          throw new Error("Razorpay is not fully configured for this store.");
        }
        const keySecret = decrypt(settings.razorpayKeySecret);
        if (!keySecret) throw new Error("Razorpay secret key is corrupted.");

        const instance = new Razorpay({ key_id: settings.razorpayKeyId, key_secret: keySecret });
        
        const safeOrderId = order._id.toString().slice(-10);
        const receipt = `rcpt_${safeOrderId}_${Date.now()}`.substring(0, 40);

        razorpayOrder = await instance.orders.create({
          amount: Math.round(totalAmount * 100),
          currency: "INR",
          receipt
        });
      } catch (rzpErr) {
        console.error("Razorpay order creation failed:", rzpErr);
        // Return 201 because the DB order IS created, but flag the error
        return res.status(201).json({ order, razorpayOrder: null, message: "Order placed but payment gateway failed to load." });
      }
    }

    // Fire and forget email notification
    sendOrderConfirmationEmail(order, store).catch(console.error);

    res.status(201).json({ order, razorpayOrder });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ VERIFY RAZORPAY PAYMENT (PUBLIC)
export const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const settings = await CheckoutSettings.findOne({ storeId: order.store });
    if (!settings) return res.status(400).json({ success: false, message: "Checkout settings not found" });

    const keySecret = decrypt(settings.razorpayKeySecret);
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto.createHmac("sha256", keySecret).update(body.toString()).digest("hex");

    if (expectedSignature === razorpay_signature) {
      order.paymentStatus = "paid";
      await order.save();
      res.json({ success: true, message: "Payment verified successfully" });
    } else {
      res.status(400).json({ success: false, message: "Invalid signature" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ CUSTOMER AUTH: SEND OTP
export const sendCustomerOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!req.store) return res.status(400).json({ message: "Store context missing" });
    const storeId = req.store._id;

    const config = await StoreAlerts.findOne({ storeId });
    if (!config || !config.isEmailEnabled || !config.emailAddress || !config.appPassword) {
      return res.status(400).json({ message: "Store owner has not configured email alerts. Please contact support." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    await CustomerOTP.findOneAndDelete({ email, storeId });
    await CustomerOTP.create({ email, storeId, otp });

    const transporter = nodemailer.createTransport({
      host: config.smtpHost, port: config.smtpPort, secure: config.smtpPort === 465,
      auth: { user: config.emailAddress, pass: config.appPassword }
    });

    await transporter.sendMail({
      from: `"${req.store.storeName}" <${config.emailAddress}>`,
      to: email,
      subject: `Verification Code - ${req.store.storeName}`,
      html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; text-align: center;">
        <h2 style="color: #76b900;">Verification Code</h2>
        <p>Please use the following OTP to verify your email and view your order history.</p>
        <h1 style="letter-spacing: 5px; background: #f4f4f4; padding: 15px; border-radius: 10px;">${otp}</h1>
        <p style="color: #777; font-size: 12px;">Valid for 5 minutes.</p>
      </div>`
    });

    res.json({ message: "OTP sent" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ CUSTOMER AUTH: VERIFY OTP
export const verifyCustomerOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!req.store) return res.status(400).json({ message: "Store context missing" });
    const storeId = req.store._id;

    const record = await CustomerOTP.findOne({ email, storeId });
    if (!record) return res.status(400).json({ message: "Invalid or expired OTP" });

    // Burn the OTP record immediately to prevent brute-forcing
    await CustomerOTP.deleteOne({ _id: record._id });

    if (record.otp !== otp) {
      return res.status(400).json({ message: "Invalid or expired OTP. Please request a new one." });
    }

    const token = jwt.sign({ email, storeId: storeId.toString() }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' });
    res.json({ token, email });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ CUSTOMER AUTH: GET ORDERS
export const getCustomerOrders = async (req, res) => {
  try {
    if (!req.store) return res.status(400).json({ message: "Store context missing" });
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return res.status(401).json({ message: "No token provided" });
    
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    
    if (decoded.storeId !== req.store._id.toString()) return res.status(403).json({ message: "Invalid token for this store" });

    const orders = await Order.find({ store: req.store._id, customerEmail: decoded.email }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

// ✅ GET ORDER (PUBLIC - FOR TRACKING)
export const getPublicOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id).populate('store', 'name websiteTitle logo favicon');
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Return only safe, non-sensitive data
    const safeOrder = {
      _id: order._id,
      createdAt: order.createdAt,
      orderStatus: order.orderStatus,
      totalAmount: order.totalAmount,
      discountAmount: order.discountAmount,
      shippingCharge: order.shippingCharge,
      orderItems: order.orderItems,
      customerName: order.customerName, // Name only, no phone/email for privacy
      store: order.store,
      paymentMethod: order.paymentMethod,
      WhasAppOrder: order.WhasAppOrder,
      ShippingMethod: order.ShippingMethod,
      ShippingTrackingNumber: order.ShippingTrackingNumber,
      ShippingCompany: order.ShippingCompany,
      DeliveryPersonName: order.DeliveryPersonName,
      DeliveryPersonPhone: order.DeliveryPersonPhone
    };

    res.json(safeOrder);
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
const adjustOrderStock = async (order, shouldRestore) => {
  const increment = shouldRestore ? 1 : -1;
  
  for (const item of order.orderItems) {
    if (!item.product) continue;
    
    if (item.variantId) {
      await Product.updateOne(
        { _id: item.product, "variants._id": item.variantId },
        {
          $inc: {
            "variants.$.stock": item.qty * increment,
            totalStock: item.qty * increment
          }
        }
      );
    } else {
      await Product.updateOne(
        { _id: item.product },
        { $inc: { totalStock: item.qty * increment } }
      );
    }
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      orderStatus, 
      paymentStatus, 
      resendEmail,
      ShippingMethod,
      ShippingTrackingNumber,
      ShippingCompany,
      DeliveryPersonName,
      DeliveryPersonPhone
    } = req.body;

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const store = await Store.findOne({ _id: order.store, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized to update this order" });

    const previousStatus = order.orderStatus;

    if (orderStatus) order.orderStatus = orderStatus;
    if (paymentStatus) order.paymentStatus = paymentStatus;

    if (ShippingMethod !== undefined) order.ShippingMethod = ShippingMethod;
    if (ShippingTrackingNumber !== undefined) order.ShippingTrackingNumber = ShippingTrackingNumber;
    if (ShippingCompany !== undefined) order.ShippingCompany = ShippingCompany;
    if (DeliveryPersonName !== undefined) order.DeliveryPersonName = DeliveryPersonName;
    if (DeliveryPersonPhone !== undefined) order.DeliveryPersonPhone = DeliveryPersonPhone;
    if (req.body.orderConfirmed !== undefined) order.orderConfirmed = req.body.orderConfirmed;

    // Clean up Google Cloud Storage if the order is cancelled
    if (orderStatus === 'canceled' && previousStatus !== 'canceled') {
      const bucketName = process.env.GCS_BUCKET;
      if (bucketName) {
        const bucketPrefix = `https://storage.googleapis.com/${bucketName}/`;
        
        for (const item of order.orderItems) {
          if (item.customImage && item.customImage.startsWith(bucketPrefix)) {
            const filePath = decodeURIComponent(item.customImage.replace(bucketPrefix, ''));
            try {
              await storage.bucket(bucketName).file(filePath).delete();
              console.log(`Deleted cancelled order custom image: ${filePath}`);
            } catch (err) {
              console.error(`Failed to delete custom image from GCS: ${filePath}`, err.message);
            }
          }
        }
      }
    }

    // Inventory stock adjustments on status transitions
    const isPreviousRestored = ['canceled', 'returned'].includes(previousStatus);
    const isNewRestored = ['canceled', 'returned'].includes(orderStatus);

    if (orderStatus && previousStatus !== orderStatus) {
      if (!isPreviousRestored && isNewRestored) {
        await adjustOrderStock(order, true);
      } else if (isPreviousRestored && !isNewRestored) {
        await adjustOrderStock(order, false);
      }
    }

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