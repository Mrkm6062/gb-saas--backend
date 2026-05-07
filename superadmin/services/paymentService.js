import Razorpay from "razorpay";
import PlatformPaymentSettings from "../../models/PlatformPaymentSettings.js";

const getRazorpayInstance = async () => {
  const settings = await PlatformPaymentSettings.findOne();
  
  if (!settings || !settings.razorpayEnabled || !settings.razorpayKeyId || !settings.razorpayKeySecret) {
    throw new Error("Razorpay keys missing in platform settings or gateway is disabled");
  }

  return new Razorpay({
    key_id: settings.razorpayKeyId,
    key_secret: settings.razorpayKeySecret,
  });
};

export const createPaymentOrder = async (amount) => {
  const razorpay = await getRazorpayInstance(); 

  const options = {
    amount: amount * 100,
    currency: "INR",
  };

  return await razorpay.orders.create(options);
};