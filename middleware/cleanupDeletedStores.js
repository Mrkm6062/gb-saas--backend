import Store from '../models/Store.js';
import { storage } from '../gcs.js';
import dotenv from 'dotenv';

dotenv.config();

const runCleanupTask = async () => {
  console.log('[CRON] Running soft-deleted stores cleanup job...');
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    const expiredStores = await Store.find({
      isDeleted: true,
      deletedAt: { $lte: cutoffDate }
    });

    const bucketName = process.env.GCS_BUCKET;
    const bucket = bucketName ? storage.bucket(bucketName) : null;

    for (const store of expiredStores) {
      const storeFolder = store.storeSlug || store.storeId;
      if (bucket) {
        try {
          await bucket.deleteFiles({ prefix: `${storeFolder}/` });
          console.log(`[CRON] Deleted GCS files for store: ${store.storeName}`);
        } catch (gcsError) {
          console.error(`[CRON] Failed to delete GCS assets for store ${store.storeName}:`, gcsError.message);
        }
      }

      await Store.findByIdAndDelete(store._id);
      console.log(`[CRON] Permanently deleted store record: ${store.storeName}`);
    }
  } catch (error) {
    console.error('[CRON] Error in cleanup deleted stores cron job:', error);
  }
};

export const startCleanupDeletedStoresCron = async () => {
  let scheduled = false;

  try {
    const cronModule = await import('node-cron');
    const cron = cronModule.default || cronModule;
    cron.schedule('0 0 * * *', async () => {
      await runCleanupTask();
    });
    scheduled = true;
  } catch (err) {
    console.warn('[CRON] node-cron not available for cleanupDeletedStores, using native timer fallback');
  }

  // Native timer fallback: computes delay to midnight every day
  const scheduleNextMidnight = () => {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    const delay = nextMidnight.getTime() - now.getTime();

    setTimeout(async () => {
      try {
        if (!scheduled) {
          await runCleanupTask();
        }
      } catch (e) {
        console.error('[CRON-TIMER] Error in midnight cleanup:', e);
      } finally {
        scheduleNextMidnight();
      }
    }, delay);
  };

  scheduleNextMidnight();
};
