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
      // Get all active stores that have an expiry date set
      const storesToRemind = await Store.find({ 
        isDeleted: { $ne: true }, 
        planExpiryDate: { $exists: true, $ne: null } 
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const store of storesToRemind) {
        const expiry = new Date(store.planExpiryDate);
        expiry.setHours(0, 0, 0, 0);
        
        const diffTime = expiry - today;
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        let subject = '';
        let message = '';

        // Determine which reminder to send
        if (diffDays === 3) {
          subject = `Action Required: Your store ${store.storeName} subscription expires in 3 days`;
          message = `is going to expire in exactly 3 days, on <strong>${new Date(store.planExpiryDate).toDateString()}</strong>.`;
        } else if (diffDays === 2) {
          subject = `Action Required: Your store ${store.storeName} subscription expires in 2 days`;
          message = `is going to expire in exactly 2 days, on <strong>${new Date(store.planExpiryDate).toDateString()}</strong>.`;
        } else if (diffDays === 1) {
          subject = `Urgent: Your store ${store.storeName} subscription expires tomorrow!`;
          message = `is expiring tomorrow, on <strong>${new Date(store.planExpiryDate).toDateString()}</strong>.`;
        } else if (diffDays <= 0 && diffDays >= -14) { 
          // Send daily reminders for up to 14 days after expiry to avoid spamming them forever
          subject = `Notice: Your store ${store.storeName} subscription has expired`;
          message = `has expired on <strong>${new Date(store.planExpiryDate).toDateString()}</strong>. Your store is currently suspended and customers cannot place orders.`;
        }

        if (subject && message) {
          const user = await User.findOne({ userId: store.ownerId });
          if (user && user.email) {
            const mailOptions = {
              from: `"Galibrand Cloud" <${process.env.EMAIL_USER}>`,
              to: user.email,
              subject: subject,
              html: `
                <div style="font-family: sans-serif; padding: 20px;">
                  <h2>Hello ${user.name},</h2>
                  <p>This is a friendly reminder that the subscription plan for your store <strong>${store.storeName}</strong> ${message}</p>
                  <p>To avoid any interruption in your service, please log in to your dashboard and renew your subscription.</p>
                  <br/>
                  <p>Best Regards,</p>
                  <p>The Galibrand Cloud Team</p>
                </div>
              `
            };
            
            try {
              await transporter.sendMail(mailOptions);
              console.log(`[CRON] Sent reminder email to ${user.email} for store ${store.storeName} (Days left: ${diffDays})`);
            } catch (err) {
              console.error(`[CRON] Failed to send email to ${user.email}:`, err.message);
            }
          }
        }
      }
    } catch (error) {
      console.error('[CRON] Error in subscription reminder cron job:', error);
    }
  });
};