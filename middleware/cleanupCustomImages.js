import cron from "node-cron";
import Order from "../models/Order.js";
import { storage } from "../gcs.js";

export const startCleanupCustomImagesCron = () => {
  // Run every day at 3:00 AM server time
  cron.schedule("0 3 * * *", async () => {
    console.log("Running cron job: Cleaning up old custom images from delivered orders...");
    
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Find delivered orders older than 30 days that have custom images
      const orders = await Order.find({
        orderStatus: "delivered",
        updatedAt: { $lte: thirtyDaysAgo },
        "orderItems.customImage": { $exists: true, $ne: null }
      });

      if (orders.length === 0) {
        console.log("No old custom images to clean up.");
        return;
      }

      const bucketName = process.env.GCS_BUCKET;
      if (!bucketName) {
        console.error("GCS_BUCKET is not defined. Cannot run custom image cleanup.");
        return;
      }

      const bucketPrefix = `https://storage.googleapis.com/${bucketName}/`;
      let deletedCount = 0;

      for (const order of orders) {
        let modified = false;

        for (const item of order.orderItems) {
          if (item.customImage && item.customImage.startsWith(bucketPrefix)) {
            const filePath = decodeURIComponent(item.customImage.replace(bucketPrefix, ''));
            try {
              await storage.bucket(bucketName).file(filePath).delete();
              item.customImage = null; // Clear from DB so we don't try deleting it again
              modified = true;
              deletedCount++;
            } catch (err) {
              // If it returns a 404, it means the file is already gone, so we should still clear it from the DB
              if (err.code === 404 || err.message.includes("No such object")) {
                item.customImage = null;
                modified = true;
              } else {
                console.error(`Failed to delete custom image from GCS: ${filePath}`, err.message);
              }
            }
          }
        }

        if (modified) {
          await order.save();
        }
      }

      console.log(`Cron job finished: Successfully cleaned up ${deletedCount} custom images.`);
    } catch (error) {
      console.error("Error in custom image cleanup cron job:", error);
    }
  });
};