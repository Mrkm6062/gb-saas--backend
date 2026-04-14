import { createPaymentOrder } from "../services/paymentService.js";

export const createPayment = async (req, res) => {
  try {
    const { amount } = req.body;

    const order = await createPaymentOrder(amount);

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};