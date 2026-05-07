import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from the root .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import PlatformPaymentSettings from '../models/PlatformPaymentSettings.js';
import CheckoutSettings from '../models/CheckoutSettings.js';
import { encrypt } from '../utils/crypto.js';

// Helper function to determine if a string is likely already encrypted
const isEncrypted = (text) => {
  if (!text) return false;
  // Our crypto.js outputs "iv:authTag:encryptedData"
  const parts = text.split(':');
  return parts.length === 3;
};

const migrate = async () => {
  if (!process.env.MONGO_URI || !process.env.ENCRYPTION_KEY) {
    console.error("Missing MONGO_URI or ENCRYPTION_KEY in environment variables.");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB. Starting migration...");

    // 1. Migrate PlatformPaymentSettings
    const platformSettings = await PlatformPaymentSettings.find();
    let platformUpdated = 0;
    for (const setting of platformSettings) {
      if (setting.razorpayKeySecret && !isEncrypted(setting.razorpayKeySecret)) {
        setting.razorpayKeySecret = encrypt(setting.razorpayKeySecret);
        await setting.save();
        platformUpdated++;
      }
    }
    console.log(`✅ Migrated ${platformUpdated} PlatformPaymentSettings record(s).`);

    // 2. Migrate CheckoutSettings
    const checkoutSettings = await CheckoutSettings.find();
    let checkoutUpdated = 0;
    for (const setting of checkoutSettings) {
      if (setting.razorpayKeySecret && !isEncrypted(setting.razorpayKeySecret)) {
        setting.razorpayKeySecret = encrypt(setting.razorpayKeySecret);
        await setting.save();
        checkoutUpdated++;
      }
    }
    console.log(`✅ Migrated ${checkoutUpdated} CheckoutSettings record(s).`);

    console.log("🎉 Migration completed successfully.");
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
};

migrate();