import cron from 'node-cron';
import Store from '../models/Store.js';
import { storage } from '../gcs.js';
import dotenv from 'dotenv';

dotenv.config();

export const startCleanupDeletedStoresCron = () => {
  // Run every day at midnight server time
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Running soft-deleted stores cleanup job...');
    try {
      // Calculate the date 30 days ago
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);

      // Find all stores soft-deleted more than 30 days ago
      const expiredStores = await Store.find({
        isDeleted: true,
        deletedAt: { $lte: cutoffDate }
      });

      const bucket = storage.bucket(process.env.GCS_BUCKET);

      for (const store of expiredStores) {
        // 1. Delete all assets from Google Cloud Storage
        const storeFolder = store.storeSlug || store.storeId;
        try {
          await bucket.deleteFiles({ prefix: `${storeFolder}/` });
          console.log(`[CRON] Deleted GCS files for store: ${store.storeName}`);
        } catch (gcsError) {
          console.error(`[CRON] Failed to delete GCS assets for store ${store.storeName}:`, gcsError);
        }

        // 2. Permanently delete the store document
        await Store.findByIdAndDelete(store._id);
        console.log(`[CRON] Permanently deleted store record: ${store.storeName}`);
      }
    } catch (error) {
      console.error('[CRON] Error in cleanup deleted stores cron job:', error);
    }
  });
};