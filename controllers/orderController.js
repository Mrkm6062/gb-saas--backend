import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Store from "../models/Store.js";
import Coupon from "../models/Coupon.js";
import StoreAlerts from "../models/StoreAlerts.js";
import { getLandingMailConfigAndTransporter } from "../services/landingEmailService.js";
import { getDefaultTemplates } from "../utils/defaultAlertTemplates.js";
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
import { sendPushToStore } from "../services/pushNotificationService.js";

const calculateOfferDiscount = (orderItems, productsInDb) => {
  let totalB1G1Discount = 0;
  const details = [];
  
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
          name: bestOffer.name,
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
    let discount = 0;
    if (group.offerType === 'B1G1') {
      const freeCount = Math.floor(count / 2);
      if (freeCount > 0) {
        const cheapestItems = group.prices.slice(-freeCount);
        discount = cheapestItems.reduce((sum, p) => sum + p, 0);
      }
    } else if (group.offerType === 'B2G1') {
      const freeCount = Math.floor(count / 3);
      if (freeCount > 0) {
        const cheapestItems = group.prices.slice(-freeCount);
        discount = cheapestItems.reduce((sum, p) => sum + p, 0);
      }
    }
    if (discount > 0) {
      totalB1G1Discount += discount;
      details.push({
        name: `Offer: ${group.name || group.offerType}`,
        amount: discount,
        type: "offer"
      });
    }
  }
  
  return {
    amount: totalB1G1Discount,
    details
  };
};

// Internal Helper function to resolve mail transporter (System Default LandingMailConfig vs Custom SMTP)
const resolveStoreMailTransporter = async (store, config) => {
  const hasCustomMail = Boolean(config && config.emailAddress && config.appPassword);
  const shouldUseDefault = (!config) || (config.useDefaultMail !== false) || !hasCustomMail;

  if (!shouldUseDefault && hasCustomMail) {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost || "smtp.gmail.com",
      port: Number(config.smtpPort) || 587,
      secure: Number(config.smtpPort) === 465,
      auth: { user: config.emailAddress, pass: config.appPassword },
      tls: { rejectUnauthorized: false }
    });
    return {
      transporter,
      fromAddress: `"${store.storeName}" <${config.emailAddress}>`,
      isDefault: false
    };
  }

  // System Default Mail (LandingMailConfig)
  const defaultMailer = await getLandingMailConfigAndTransporter();
  if (!defaultMailer) {
    return null;
  }
  const senderEmail = defaultMailer.config.fromEmail || defaultMailer.config.smtpUser;
  return {
    transporter: defaultMailer.transporter,
    fromAddress: `"${store.storeName}" <${senderEmail}>`,
    isDefault: true
  };
};

// Internal / Exported Helper function to send order confirmation email asynchronously
export const sendOrderConfirmationEmail = async (order, store) => {
  if (!order || !order.customerEmail) return;
  try {
    const config = await StoreAlerts.findOne({ storeId: store._id });
    if (config && config.isEmailEnabled === false) return;

    const mailer = await resolveStoreMailTransporter(store, config);
    if (!mailer) {
      console.warn(`[orderController] No mail transporter available for store: ${store.storeName}`);
      return;
    }

    const itemsHtml = (order.orderItems || []).map(item => {
      const customImgHtml = item.customImage ? `<br><span style="font-size: 11px; color: #666; display: block; margin-top: 4px;">Custom Image:</span><a href="${item.customImage}" target="_blank"><img src="${item.customImage}" style="max-height: 60px; border-radius: 4px; margin-top: 4px; border: 1px solid #eee;" alt="Custom Design"/></a>` : '';
      return `<tr><td style="padding:8px; border-bottom:1px solid #ddd; vertical-align:top;">${item.qty}x ${item.name}${customImgHtml}</td><td style="padding:8px; border-bottom:1px solid #ddd; text-align:right; vertical-align:top;">₹${item.price * item.qty}</td></tr>`;
    }).join('');
    
    let domainRecord = null;
    try {
      domainRecord = await Domain.findOne({ storeId: store._id, status: 'connected' });
    } catch (e) {}
    const storeUrl = domainRecord ? `https://${domainRecord.domain}` : `https://${store.subdomain}`;
    
    const reviewLinksHtml = (order.orderItems || []).map(item => 
      `<div style="margin-bottom: 10px;"><a href="${storeUrl}/review/${order._id}/${item.product?._id || item.product}" style="display: inline-block; background-color: #76b900; color: #ffffff; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">Review ${item.name}</a></div>`
    ).join('');
    
    let template = config?.templates?.find(t => t.eventType === 'order_placed' && t.isActive !== false);
    if (!template) {
      const defaultTemplates = getDefaultTemplates(store.storeName);
      template = defaultTemplates.find(t => t.eventType === 'order_placed');
    }

    const resolvedPaymentMethod = (order.paymentMethod === 'whatsapp' || order.WhasAppOrder) ? 'WhatsApp' : order.paymentMethod === 'razorpay' ? 'Online' : 'COD';
    const resolvedOrderStatus = order.orderStatus ? order.orderStatus.toUpperCase() : "PLACED";

    let discountRowsHtml = '';
    if (order.discountDetails && order.discountDetails.length > 0) {
      discountRowsHtml = order.discountDetails.map(detail => `
        <tr>
          <td style="padding: 5px 10px; text-align: left;"><strong>${detail.name}:</strong></td>
          <td style="padding: 5px 10px; text-align: right;">-₹${detail.amount}</td>
        </tr>
      `).join('');
    } else {
      discountRowsHtml = `
        <tr>
          <td style="padding: 5px 10px; text-align: left;"><strong>Discount:</strong></td>
          <td style="padding: 5px 10px; text-align: right;">-₹${order.discountAmount || 0}</td>
        </tr>
      `;
    }

    let subject = `Order Received - ${store.storeName}`;
    let html = '';

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
        .replace(/{{discountRows}}/g, discountRowsHtml)
        .replace(/{{paymentMethod}}/g, resolvedPaymentMethod)
        .replace(/{{orderStatus}}/g, resolvedOrderStatus)
        .replace(/{{trackingDetails}}/g, '')
        .replace(/{{ShippingMethod}}/g, order.ShippingMethod || 'N/A')
        .replace(/{{ShippingTrackingNumber}}/g, order.ShippingTrackingNumber || 'N/A')
        .replace(/{{ShippingCompany}}/g, order.ShippingCompany || 'N/A')
        .replace(/{{DeliveryPersonName}}/g, order.DeliveryPersonName || 'N/A')
        .replace(/{{DeliveryPersonPhone}}/g, order.DeliveryPersonPhone || 'N/A')
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
        <p style="text-align: right; font-size: 16px; margin: 5px 0;"><strong>Shipping:</strong> ₹${order.shippingCharge || 0}</p>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">${discountRowsHtml}</table>
        <p style="text-align: right; font-size: 18px; margin: 5px 0;"><strong>Total Paid:</strong> ₹${order.totalAmount}</p>
        <p><strong>Payment Method:</strong> ${resolvedPaymentMethod}</p>
        <p><strong>Order Status:</strong> ${resolvedOrderStatus}</p>
        <br/>
        <p>We'll notify you once your order has shipped!</p>
      </div>`;
    }

    await mailer.transporter.sendMail({
      from: mailer.fromAddress,
      to: order.customerEmail,
      subject,
      html
    });
  } catch (err) {
    console.error("Failed to send order confirmation email:", err.message);
  }
};

// Internal / Exported Helper function to send order status update email asynchronously
export const sendStatusUpdateEmail = async (order, store, status) => {
  if (!order || !order.customerEmail) return;
  try {
    const config = await StoreAlerts.findOne({ storeId: store._id });
    if (config && config.isEmailEnabled === false) return;

    const eventTypeMap = {
      preparing: 'order_preparing',
      order_preparing: 'order_preparing',
      shipped: 'order_shipped',
      order_shipped: 'order_shipped',
      delivered: 'order_delivered',
      order_delivered: 'order_delivered',
      canceled: 'order_canceled',
      cancelled: 'order_canceled',
      order_canceled: 'order_canceled',
      returned: 'order_returned',
      order_returned: 'order_returned'
    };
    const eventType = eventTypeMap[status];
    if (!eventType) return;

    const userConfiguredTemplate = config?.templates?.find(t => t.eventType === eventType);
    if (userConfiguredTemplate && userConfiguredTemplate.isActive === false) {
      return; // Store owner explicitly disabled this alert
    }

    let template = userConfiguredTemplate;
    if (!template) {
      const defaultTemplates = getDefaultTemplates(store.storeName);
      template = defaultTemplates.find(t => t.eventType === eventType);
    }
    if (!template) return;

    const mailer = await resolveStoreMailTransporter(store, config);
    if (!mailer) {
      console.warn(`[orderController] No mail transporter available for store: ${store.storeName}`);
      return;
    }

    const itemsHtml = (order.orderItems || []).map(item => {
      const customImgHtml = item.customImage ? `<br><span style="font-size: 11px; color: #666; display: block; margin-top: 4px;">Custom Image:</span><a href="${item.customImage}" target="_blank"><img src="${item.customImage}" style="max-height: 60px; border-radius: 4px; margin-top: 4px; border: 1px solid #eee;" alt="Custom Design"/></a>` : '';
      return `<tr><td style="padding:8px; border-bottom:1px solid #ddd; vertical-align:top;">${item.qty}x ${item.name}${customImgHtml}</td><td style="padding:8px; border-bottom:1px solid #ddd; text-align:right; vertical-align:top;">₹${item.price * item.qty}</td></tr>`;
    }).join('');
    
    let domainRecord = null;
    try {
      domainRecord = await Domain.findOne({ storeId: store._id, status: 'connected' });
    } catch (e) {}
    const storeUrl = domainRecord ? `https://${domainRecord.domain}` : `https://${store.subdomain}`;
    
    const reviewLinksHtml = (order.orderItems || []).map(item => 
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

    const resolvedPaymentMethod = (order.paymentMethod === 'whatsapp' || order.WhasAppOrder) ? 'WhatsApp' : order.paymentMethod === 'razorpay' ? 'Online' : 'COD';
    const resolvedOrderStatus = order.orderStatus ? order.orderStatus.toUpperCase() : "";

    let discountRowsHtml = '';
    if (order.discountDetails && order.discountDetails.length > 0) {
      discountRowsHtml = order.discountDetails.map(detail => `
        <tr>
          <td style="padding: 5px 10px; text-align: left;"><strong>${detail.name}:</strong></td>
          <td style="padding: 5px 10px; text-align: right;">-₹${detail.amount}</td>
        </tr>
      `).join('');
    } else {
      discountRowsHtml = `
        <tr>
          <td style="padding: 5px 10px; text-align: left;"><strong>Discount:</strong></td>
          <td style="padding: 5px 10px; text-align: right;">-₹${order.discountAmount || 0}</td>
        </tr>
      `;
    }

    const subject = template.subject
      .replace(/{{storeName}}/g, store.storeName)
      .replace(/{{customerName}}/g, order.customerName)
      .replace(/{{orderId}}/g, order._id.toString().slice(-6).toUpperCase());

    const html = template.body
      .replace(/{{storeName}}/g, store.storeName)
      .replace(/{{customerName}}/g, order.customerName)
      .replace(/{{orderId}}/g, order._id.toString().slice(-6).toUpperCase())
      .replace(/{{orderItems}}/g, `<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">${itemsHtml}</table>`)
      .replace(/{{totalAmount}}/g, order.totalAmount)
      .replace(/{{discountAmount}}/g, order.discountAmount || 0)
      .replace(/{{discountRows}}/g, discountRowsHtml)
      .replace(/{{paymentMethod}}/g, resolvedPaymentMethod)
      .replace(/{{orderStatus}}/g, resolvedOrderStatus)
      .replace(/{{shippingCharge}}/g, order.shippingCharge || 0)
      .replace(/{{reviewLinks}}/g, reviewLinksHtml)
      .replace(/{{trackingDetails}}/g, trackingDetailsHtml)
      .replace(/{{ShippingMethod}}/g, order.ShippingMethod || 'N/A')
      .replace(/{{ShippingTrackingNumber}}/g, order.ShippingTrackingNumber || 'N/A')
      .replace(/{{ShippingCompany}}/g, order.ShippingCompany || 'N/A')
      .replace(/{{DeliveryPersonName}}/g, order.DeliveryPersonName || 'N/A')
      .replace(/{{DeliveryPersonPhone}}/g, order.DeliveryPersonPhone || 'N/A');

    await mailer.transporter.sendMail({
      from: mailer.fromAddress,
      to: order.customerEmail,
      subject,
      html
    });
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
      shippingCharge,
      paymentMethod,
      orderSource,
      orderType,
      orderBy,
      tableNumber,
      paymentStatus,
      orderStatus
    } = req.body;

    let store = req.store;
    if (!store && (req.body.storeId || req.headers['x-store-id'])) {
      const targetStoreId = String(req.body.storeId || req.headers['x-store-id']).trim();
      const isMongoId = /^[0-9a-fA-F]{24}$/.test(targetStoreId);
      const orConditions = [{ storeId: targetStoreId }];
      if (isMongoId) {
        orConditions.push({ _id: targetStoreId });
      }
      store = await Store.findOne({ $or: orConditions });
    }

    if (!store) {
      return res.status(400).json({ message: "Store context missing. Make sure you are ordering from a valid store domain." });
    }

    // Resolve restaurant ordering parameters
    const resolvedOrderSource = (orderSource || "web").toLowerCase();

    if (resolvedOrderSource !== "counter") {
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
    }
    let resolvedOrderType = orderType;
    if (!resolvedOrderType) {
      resolvedOrderType = resolvedOrderSource === "web" ? "delivery" : "Dine-in";
    } else {
      resolvedOrderType = /dine/i.test(resolvedOrderType) ? "Dine-in" : "delivery";
    }

    const resolvedTableNumber = tableNumber !== undefined && tableNumber !== null && String(tableNumber).trim() !== ""
      ? String(tableNumber).trim()
      : "0";

    let resolvedOrderBy = orderBy || "";
    if (resolvedOrderSource === "counter" && !resolvedOrderBy) {
      resolvedOrderBy = "counter";
    }

    const isDineIn = resolvedOrderType === "Dine-in";
    
    // Validate Delivery Rules Securely on the Backend (Only for delivery orders)
    let deliverySettings = null;
    if (!isDineIn) {
      deliverySettings = await DeliverySettings.findOne({ storeId: store._id });
      if (deliverySettings) {
        if (deliverySettings.deliveryMode === 'state') {
          const allowed = deliverySettings.allowedStates.map(s => s.toLowerCase());
          if (!allowed.includes((address?.state || '').toLowerCase().trim())) {
            return res.status(400).json({ message: `Sorry, we do not deliver to ${address?.state} at the moment.` });
          }
        } else if (deliverySettings.deliveryMode === 'pincode') {
          if (!deliverySettings.allowedPincodes.includes((address?.pincode || '').trim())) {
            return res.status(400).json({ message: `Sorry, we do not deliver to pincode ${address?.pincode} at the moment.` });
          }
        }
      }
    }

    const productIds = orderItems.map(item => item.product);
    const productsInDb = await Product.find({ _id: { $in: productIds } }).populate('offerCategories');
    const offerDiscountResult = calculateOfferDiscount(orderItems, productsInDb);
    const offerDiscount = offerDiscountResult.amount;

    const calculatedDiscountAmount = (Number(discountAmount) || 0) + offerDiscount;
    const rawSubtotal = orderItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.qty)), 0);

    // Validate Minimum Order Limit Threshold Securely (delivery only)
    if (!isDineIn && deliverySettings && deliverySettings.minimumOrderLimitThreshold > 0) {
      if (rawSubtotal < deliverySettings.minimumOrderLimitThreshold) {
        return res.status(400).json({ 
          message: `Minimum order amount of ₹${deliverySettings.minimumOrderLimitThreshold} is required to place an order. Please add more products to your cart to reach the threshold (Current: ₹${rawSubtotal}).` 
        });
      }
    }

    const resolvedShippingCharge = isDineIn ? 0 : (Number(shippingCharge) || 0);
    const calculatedTotalAmount = Math.max(0, rawSubtotal - calculatedDiscountAmount + resolvedShippingCharge);

    const discountDetails = [...offerDiscountResult.details];
    if (couponCode && (Number(discountAmount) || 0) > 0) {
      discountDetails.push({
        name: `Coupon: ${couponCode}`,
        amount: Number(discountAmount),
        type: "coupon"
      });
    }

    const resolvedAddress = isDineIn ? {
      addressLine1: address?.addressLine1 || `Dine-in (Table ${resolvedTableNumber})`,
      landmark: address?.landmark || `Table ${resolvedTableNumber}`,
      city: address?.city || store.locationAddress || "Restaurant",
      state: address?.state || "",
      pincode: address?.pincode || "000000",
      mobileNumber: customerPhone || address?.mobileNumber || "",
      alternateNumber: address?.alternateNumber || ""
    } : address;

    const order = await Order.create({
      store: store._id,
      customerName,
      customerEmail,
      customerPhone,
      address: resolvedAddress,
      orderItems,
      totalAmount: calculatedTotalAmount,
      couponCode,
      discountAmount: calculatedDiscountAmount,
      discountDetails,
      shippingCharge: resolvedShippingCharge,
      paymentMethod: paymentMethod || 'cod',
      orderSource: resolvedOrderSource,
      orderType: resolvedOrderType,
      orderBy: resolvedOrderBy,
      tableNumber: resolvedTableNumber,
      WhasAppOrder: paymentMethod === 'whatsapp',
      paymentStatus: paymentStatus || (resolvedOrderSource === "counter" ? "paid" : "pending"),
      orderStatus: orderStatus || "placed",
      deliveredAt: orderStatus === "delivered" ? new Date() : null,
      orderConfirmed: resolvedOrderSource === "counter" ? true : false
    });

    // Send push notification to subscribed devices for store
    const storeCode = store.storeId || store._id.toString();
    const orderTypeLabel = isDineIn ? `[Dine-in Table ${resolvedTableNumber}]` : '[Delivery]';
    sendPushToStore(store._id, {
      title: `🎉 New Order #${order._id.toString().slice(-6).toUpperCase()} ${orderTypeLabel}`,
      body: `${customerName || "A customer"} placed an order of ₹${calculatedTotalAmount}.${isDineIn ? ` Table: ${resolvedTableNumber}` : ''}`,
      data: {
        url: `/store/${storeCode}/live-orders`,
        orderId: order._id.toString()
      }
    }).catch(err => console.error("Error triggering push notification:", err.message));

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
      orderSource: order.orderSource,
      orderType: order.orderType,
      orderBy: order.orderBy,
      tableNumber: order.tableNumber,
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

    const orders = await Order.find({ store: storeId })
      .populate("orderItems.product", "images")
      .populate("deliveryStaff", "name phone staffId")
      .sort({ createdAt: -1 });

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
      DeliveryPersonPhone,
      deliveryStaff,
      wastedReason
    } = req.body;

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const store = await Store.findOne({ _id: order.store, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized to update this order" });

    const previousStatus = order.orderStatus;
    const previousPaymentStatus = order.paymentStatus;

    // Check if order was already delivered
    if (previousStatus === 'delivered') {
      const deliveredTime = order.deliveredAt || order.updatedAt;
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      if (deliveredTime && new Date(deliveredTime) < tenDaysAgo) {
        return res.status(400).json({ message: "Delivered orders cannot be modified after 10 days." });
      }

      if (orderStatus && orderStatus !== 'returned' && orderStatus !== 'delivered') {
        return res.status(400).json({ message: "Delivered orders can only be updated to returned status." });
      }
    }

    if (['canceled', 'returned'].includes(previousStatus)) {
      if (orderStatus && orderStatus !== previousStatus) {
        return res.status(400).json({ message: "Cannot change the status of a canceled or returned order." });
      }
      if (paymentStatus && paymentStatus !== previousPaymentStatus) {
        if (paymentStatus === 'refunded' && previousPaymentStatus === 'paid') {
          // Refund is allowed for paid canceled/returned orders
        } else {
          return res.status(400).json({ message: "Cannot modify payment status of a canceled/returned order unless processing a refund for a paid transaction." });
        }
      }
    }

    if (orderStatus) order.orderStatus = orderStatus;
    if (paymentStatus) order.paymentStatus = paymentStatus;

    if (orderStatus === 'delivered' && previousStatus !== 'delivered') {
      order.deliveredAt = new Date();
    }
    if (orderStatus === 'preparing' && previousStatus !== 'preparing') {
      order.preparingAt = new Date();
    }
    if (orderStatus === 'shipped' && previousStatus !== 'shipped') {
      order.shippedAt = new Date();
    }
    if (orderStatus === 'wasted' && previousStatus !== 'wasted') {
      order.wastedAt = new Date();
    }
    if (wastedReason !== undefined) {
      order.wastedReason = wastedReason;
    }
    if (deliveryStaff !== undefined) {
      order.deliveryStaff = deliveryStaff || null;
    }

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

// ✅ GET PUBLIC RECEIPT / DIGITAL BILL (HTML / PRINTABLE)
export const getPublicReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id).populate("store");
    if (!order) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html><head><title>Receipt Not Found</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h2>Receipt Not Found</h2>
          <p>The requested order or receipt could not be found.</p>
        </body></html>
      `);
    }

    const store = order.store || {};
    const orderNumber = order._id.toString().slice(-6).toUpperCase();
    const orderDate = new Date(order.createdAt).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const itemsRows = (order.orderItems || [])
      .map(
        (item) => `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 8px; font-size: 13px; color: #1e293b;">
            <strong>${item.name}</strong>
            ${item.foodType ? `<span style="margin-left: 6px; font-size: 10px; padding: 2px 5px; border-radius: 4px; background: ${item.foodType === 'veg' ? '#dcfce7; color: #15803d' : '#fee2e2; color: #b91c1c'}; font-weight: bold;">${item.foodType.toUpperCase()}</span>` : ''}
          </td>
          <td style="padding: 10px 8px; text-align: center; font-size: 13px; color: #1e293b;">${item.qty}</td>
          <td style="padding: 10px 8px; text-align: right; font-size: 13px; color: #64748b;">Rs. ${Number(item.price).toFixed(2)}</td>
          <td style="padding: 10px 8px; text-align: right; font-size: 13px; font-weight: bold; color: #1e293b;">Rs. ${Number(item.price * item.qty).toFixed(2)}</td>
        </tr>
      `
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Receipt #${orderNumber} - ${store.storeName || "Retail Receipt"}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; margin: 0; padding: 20px 10px; color: #0f172a; }
          .receipt-card { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04); border: 1px solid #e2e8f0; }
          .receipt-header { background: linear-gradient(135deg, #0f172a, #1e293b); color: #fff; padding: 24px; text-align: center; }
          .actions { padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; gap: 10px; }
          .btn { flex: 1; padding: 12px; border-radius: 10px; font-weight: bold; font-size: 13px; cursor: pointer; text-align: center; border: none; text-decoration: none; }
          .btn-print { background: #0f172a; color: #fff; }
          .btn-print:hover { background: #1e293b; }
          @media print {
            body { padding: 0; background: #fff; }
            .receipt-card { max-width: 100%; border: none; box-shadow: none; border-radius: 0; }
            .actions { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="receipt-card">
          <div class="receipt-header">
            ${store.logo ? `<img src="${store.logo}" alt="${store.storeName}" style="max-height: 48px; margin-bottom: 8px; border-radius: 6px;">` : ""}
            <h1 style="margin: 0; font-size: 20px; font-weight: 800;">${store.storeName || "Store Receipt"}</h1>
            <p style="margin: 4px 0 0; font-size: 11px; opacity: 0.85;">${store.locationAddress || "Thank you for your visit!"}</p>
            ${store.storeId ? `<p style="margin: 2px 0 0; font-size: 10px; opacity: 0.7;">Store Code: ${store.storeId}</p>` : ""}
          </div>
          <div style="padding: 20px 24px;">
            <div style="display: flex; justify-content: space-between; border-bottom: 2px dashed #cbd5e1; padding-bottom: 12px; margin-bottom: 16px;">
              <div>
                <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b;">Receipt / Invoice</div>
                <div style="font-size: 16px; font-weight: 800; color: #0284c7;">#${orderNumber}</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${orderDate}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b;">Order Type</div>
                <div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-top: 2px;">
                  ${order.tableNumber && order.tableNumber !== "0" ? `Dine-in (Table ${order.tableNumber})` : (order.orderType || "Counter / Takeaway")}
                </div>
                ${order.orderBy ? `<div style="font-size: 10px; color: #64748b; margin-top: 2px;">Billed: ${order.orderBy}</div>` : ""}
              </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
              <thead>
                <tr style="background: #f1f5f9; border-bottom: 1px solid #e2e8f0;">
                  <th style="padding: 8px; text-align: left; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase;">Item</th>
                  <th style="padding: 8px; text-align: center; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase;">Qty</th>
                  <th style="padding: 8px; text-align: right; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase;">Price</th>
                  <th style="padding: 8px; text-align: right; font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
            </table>

            <div style="border-top: 2px dashed #cbd5e1; padding-top: 12px; margin-bottom: 16px;">
              ${order.discountAmount > 0 ? `
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: #64748b; margin-bottom: 4px;">
                  <span>Subtotal</span>
                  <span>Rs. ${((order.totalAmount || 0) + (order.discountAmount || 0)).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: #16a34a; font-weight: 600; margin-bottom: 4px;">
                  <span>Discount</span>
                  <span>-Rs. ${Number(order.discountAmount).toFixed(2)}</span>
                </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 6px;">
                <span>Grand Total</span>
                <span>Rs. ${Number(order.totalAmount || 0).toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-top: 6px;">
                <span>Payment Method</span>
                <span style="font-weight: 700; text-transform: uppercase; color: #16a34a;">${order.paymentMethod || "CASH"} (PAID ✓)</span>
              </div>
            </div>

            <div style="text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 12px;">
              <p style="margin: 0; font-weight: 600; color: #475569;">Thank you for your visit!</p>
              <p style="margin: 2px 0 0;">Please visit us again soon.</p>
            </div>
          </div>

          <div class="actions">
            <button class="btn btn-print" onclick="window.print()">🖨️ Print / Save PDF</button>
          </div>
        </div>
      </body>
      </html>
    `;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (error) {
    res.status(500).send("Error loading receipt: " + error.message);
  }
};
