import Order from "../models/Order.js";
import { storage } from "../gcs.js";

const runCustomImageCleanup = async () => {
  console.log("Running cron job: Cleaning up old custom images from delivered orders...");
  
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

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
            item.customImage = null;
            modified = true;
            deletedCount++;
          } catch (err) {
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
};

export const startCleanupCustomImagesCron = async () => {
  let scheduled = false;

  try {
    const cronModule = await import('node-cron');
    const cron = cronModule.default || cronModule;
    cron.schedule("0 3 * * *", async () => {
      await runCustomImageCleanup();
    });
    scheduled = true;
  } catch (err) {
    console.warn('[CRON] node-cron not available for cleanupCustomImages, using native timer fallback');
  }

  // Native timer fallback: computes delay to 3:00 AM every day
  const scheduleNext3AM = () => {
    const now = new Date();
    const next3AM = new Date(now);
    next3AM.setHours(3, 0, 0, 0);
    if (next3AM <= now) {
      next3AM.setDate(next3AM.getDate() + 1);
    }
    const delay = next3AM.getTime() - now.getTime();

    setTimeout(async () => {
      try {
        if (!scheduled) {
          await runCustomImageCleanup();
        }
      } catch (e) {
        console.error('[CRON-TIMER] Error in 3:00 AM image cleanup:', e);
      } finally {
        scheduleNext3AM();
      }
    }, delay);
  };

  scheduleNext3AM();
};
