import Razorpay from "razorpay";

const getRazorpayInstance = () => {
  if (!process.env.RAZORPAY_KEY || !process.env.RAZORPAY_SECRET) {
    throw new Error("Razorpay keys missing in environment variables");
  }

  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY,
    key_secret: process.env.RAZORPAY_SECRET,
  });
};

export const createPaymentOrder = async (amount) => {
  const razorpay = getRazorpayInstance(); // ✅ INIT HERE (AFTER ENV LOAD)

  const options = {
    amount: amount * 100,
    currency: "INR",
  };

  return await razorpay.orders.create(options);
};