import Order from "../models/Order.js";
import Product from "../models/Product.js";

// ✅ CREATE ORDER (PUBLIC - FROM STORE FRONT)
export const createOrder = async (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      address,
      items,
    } = req.body;

    // Validate store
    if (!req.store) {
      return res.status(400).json({ message: "Invalid store" });
    }

    let orderItems = [];
    let totalAmount = 0;

    for (let item of items) {
      const product = await Product.findOne({
        _id: item.productId,
        store: req.store._id,
      });

      if (!product) continue;

      orderItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        qty: item.qty,
      });

      totalAmount += product.price * item.qty;
    }

    const order = await Order.create({
      store: req.store._id,
      customerName,
      customerEmail,
      customerPhone,
      address,
      orderItems,
      totalAmount,
    });

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ GET ORDERS (DASHBOARD)
export const getOrders = async (req, res) => {
  try {
    const orders = await Order.find({ store: req.store._id }).sort({
      createdAt: -1,
    });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ UPDATE ORDER STATUS
export const updateOrderStatus = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      store: req.store._id,
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    order.orderStatus = req.body.status || order.orderStatus;

    const updated = await order.save();

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};