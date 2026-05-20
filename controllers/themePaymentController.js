import Razorpay from 'razorpay';
import crypto from 'crypto';
import Store from '../models/Store.js';
import Theme from '../models/Theme.js';
import PlatformPaymentSettings from '../models/PlatformPaymentSettings.js';
import { decrypt } from "../utils/crypto.js";

// CREATE ORDER FOR THEME PURCHASE
export const createThemePurchaseOrder = async (req, res) => {
    try {
        const { themeId, storeId } = req.body;
        const userId = req.user._id;

        const theme = await Theme.findById(themeId);
        if (!theme || theme.type !== 'paid' || !theme.price || theme.price <= 0) {
            return res.status(400).json({ message: "This theme is not available for purchase." });
        }

        const store = await Store.findOne({ _id: storeId, ownerId: req.user.userId });
        if (!store) {
            return res.status(404).json({ message: "Store not found or you are not the owner." });
        }
        
        if (store.paidThemes?.some(pt => pt.themeId === theme.themeId)) {
            return res.status(400).json({ message: "You have already purchased this theme." });
        }

        const settings = await PlatformPaymentSettings.findOne();
        if (!settings || !settings.razorpayEnabled || !settings.razorpayKeyId || !settings.razorpayKeySecret) {
            return res.status(500).json({ message: "Platform payment gateway is not configured." });
        }

        const keySecret = decrypt(settings.razorpayKeySecret);
        if (!keySecret) {
            return res.status(500).json({ message: "Razorpay secret key is missing or corrupted." });
        }

        const instance = new Razorpay({
            key_id: settings.razorpayKeyId,
            key_secret: keySecret,
        });

        const rawReceipt = `receipt_theme_${theme.themeId}_${store._id}_${Date.now()}`;

        const options = {
            amount: theme.price * 100, // amount in the smallest currency unit
            currency: "INR",
            receipt: rawReceipt.substring(0, 40),
            notes: {
                purchaseType: 'theme',
                themeId: theme._id.toString(),
                themeName: theme.name,
                storeId: store._id.toString(),
                userId: userId.toString()
            }
        };

        const order = await instance.orders.create(options);
        res.json(order);

    } catch (error) {
        console.error("Error creating theme purchase order:", error);
        res.status(500).json({ message: "Server error while creating order." });
    }
};

// VERIFY THEME PURCHASE PAYMENT
export const verifyThemePurchase = async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, storeId, themeId } = req.body;

        const settings = await PlatformPaymentSettings.findOne();
        if (!settings || !settings.razorpayKeySecret) {
            return res.status(500).json({ message: "Platform payment gateway is not configured." });
        }

        const keySecret = decrypt(settings.razorpayKeySecret);
        if (!keySecret) {
            return res.status(500).json({ message: "Razorpay secret key is missing or corrupted." });
        }

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', keySecret)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature === razorpay_signature) {
            const theme = await Theme.findById(themeId);
            if (!theme) return res.status(404).json({ success: false, message: "Theme not found." });

            const store = await Store.findById(storeId);
            if (!store) return res.status(404).json({ success: false, message: "Store not found." });

            if (!store.paidThemes?.some(pt => pt.themeId === theme.themeId)) {
                store.paidThemes.push({
                    themeId: theme.themeId,
                    transactionId: razorpay_payment_id
                });
            }
            
            store.theme = theme.themeId;
            await store.save();

            res.json({ success: true, message: "Theme purchased and applied successfully!" });
        } else {
            res.status(400).json({ success: false, message: "Payment verification failed." });
        }
    } catch (error) {
        console.error("Error verifying theme purchase:", error);
        res.status(500).json({ success: false, message: "Server error during verification." });
    }
};

// GET RAZORPAY PUBLIC KEY
export const getPublicKey = async (req, res) => {
    try {
        const settings = await PlatformPaymentSettings.findOne();
        if (!settings || !settings.razorpayEnabled || !settings.razorpayKeyId) {
            return res.status(404).json({ razorpayEnabled: false, message: "Razorpay is not enabled on this platform." });
        }
        res.json({ razorpayKeyId: settings.razorpayKeyId, razorpayEnabled: true });
    } catch (error) {
        res.status(500).json({ message: "Server error fetching payment key." });
    }
};