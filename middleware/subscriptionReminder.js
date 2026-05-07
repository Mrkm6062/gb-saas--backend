import cron from 'node-cron';
import Store from '../models/Store.js';
import User from '../models/User.js';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const startSubscriptionReminderCron = () => {
  // Run every day at 8:00 AM server time
  cron.schedule('0 8 * * *', async () => {
    console.log('[CRON] Running subscription expiry reminder job...');
    try {
      // Calculate the start and end of the date 3 days from now
      const targetDateStart = new Date();
      targetDateStart.setDate(targetDateStart.getDate() + 3);
      targetDateStart.setHours(0, 0, 0, 0);

      const targetDateEnd = new Date();
      targetDateEnd.setDate(targetDateEnd.getDate() + 3);
      targetDateEnd.setHours(23, 59, 59, 999);

      // Find all stores expiring in exactly 3 days that are not already expired/pending
      const storesToRemind = await Store.find({
        planExpiryDate: { $gte: targetDateStart, $lte: targetDateEnd },
        subscriptionStatus: { $nin: ['pending', 'expired'] }
      });

      for (const store of storesToRemind) {
        const user = await User.findOne({ userId: store.ownerId });
        if (user && user.email) {
          const mailOptions = {
            from: `"Galibrand Cloud" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: `Action Required: Your store ${store.storeName} subscription expires in 3 days`,
            html: `
              <div style="font-family: sans-serif; padding: 20px;">
                <h2>Hello ${user.name},</h2>
                <p>This is a friendly reminder that the subscription plan for your store <strong>${store.storeName}</strong> is going to expire in exactly 3 days, on <strong>${store.planExpiryDate.toDateString()}</strong>.</p>
                <p>To avoid any interruption in your service, please log in to your dashboard and renew your subscription.</p>
                <br/>
                <p>Best Regards,</p>
                <p>The Galibrand Cloud Team</p>
              </div>
            `
          };
          await transporter.sendMail(mailOptions);
          console.log(`[CRON] Sent reminder email to ${user.email} for store ${store.storeName}`);
        }
      }
    } catch (error) {
      console.error('[CRON] Error in subscription reminder cron job:', error);
    }
  });
};