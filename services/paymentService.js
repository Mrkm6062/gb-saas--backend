import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY,
  key_secret: process.env.RAZORPAY_SECRET,
});

export const createPaymentOrder = async (amount) => {
  const options = {
    amount: amount * 100, // paisa
    currency: "INR",
  };

  return await razorpay.orders.create(options);
};