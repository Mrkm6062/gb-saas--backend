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
<div style="font-family: Arial, Helvetica, sans-serif; background-color: #f4f7f6; padding: 30px 15px; color: #333333;">

  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #15803d, #16a34a, #ca8a04); padding: 30px 20px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; letter-spacing: 1px;">
        Galibrand
      </h1>
      <p style="color: #f0fdf4; margin: 8px 0 0; font-size: 13px;">
        Your Business. Your Brand. Your Digital Store.
      </p>
    </div>

    <!-- Email Content -->
    <div style="padding: 30px 25px;">

      <h2 style="color: #166534; font-size: 22px; margin-top: 0;">
        Hello ${user.name},
      </h2>

      <p style="font-size: 15px; line-height: 1.7; color: #4b5563;">
        This is a friendly reminder that the subscription plan for your store
        <strong style="color: #15803d;">${store.storeName}</strong>
        ${message}
      </p>

      <!-- Reminder Box -->
      <div style="background-color: #fff7ed; border-left: 4px solid #f59e0b; padding: 16px; margin: 25px 0; border-radius: 6px;">
        <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
          <strong>Subscription Reminder</strong><br/>
          To avoid any interruption in your service, please log in to your dashboard and renew your subscription.
        </p>
      </div>

      <p style="font-size: 15px; line-height: 1.7; color: #4b5563;">
        Thank you for choosing <strong style="color: #15803d;">Galibrand Cloud</strong>.
        We are happy to be part of your digital business journey!
      </p>

      <br/>

      <p style="font-size: 14px; color: #4b5563; margin-bottom: 5px;">
        Best Regards,
      </p>
      <p style="font-size: 15px; font-weight: bold; color: #15803d; margin-top: 0;">
        The Galibrand Cloud Team
      </p>

    </div>

    <!-- Footer -->
    <div style="background-color: #f0fdf4; padding: 20px; text-align: center; border-top: 1px solid #dcfce7;">
      <p style="font-size: 13px; color: #166534; margin: 0 0 8px;">
        Empowering Businesses to Grow Online
      </p>
      <p style="font-size: 12px; color: #6b7280; margin: 0;">
        © ${new Date().getFullYear()} Galibrand Cloud. All rights reserved.
      </p>
      <p style="font-size: 12px; margin: 10px 0 0;">
        <a href="https://galibrand.cloud" style="color: #15803d; text-decoration: none; font-weight: bold;">
          Visit Galibrand
        </a>
      </p>
    </div>

  </div>
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