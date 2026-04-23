import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Store from "../models/Store.js";

// ✅ CREATE ORDER (PUBLIC - FROM STORE FRONT)
export const createOrder = async (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      address,
      orderItems,
      totalAmount
    } = req.body;

    // Prioritize subdomain from Origin header (via middleware), fallback to x-store header
    const storeSlug = req.subdomain || req.headers['x-store'];
    if (!storeSlug) {
      return res.status(400).json({ message: "Store context missing. Make sure you are ordering from a valid store domain." });
    }

    const store = await Store.findOne({ storeSlug });
    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    const order = await Order.create({
      store: store._id,
      customerName,
      customerEmail,
      customerPhone,
      address,
      orderItems,
      totalAmount,
      paymentStatus: "pending",
      orderStatus: "placed"
    });

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
    const { orderStatus, paymentStatus } = req.body;

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const store = await Store.findOne({ _id: order.store, ownerId: req.user.userId });
    if (!store) return res.status(403).json({ message: "Not authorized to update this order" });

    if (orderStatus) order.orderStatus = orderStatus;
    if (paymentStatus) order.paymentStatus = paymentStatus;

    const updated = await order.save();

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};