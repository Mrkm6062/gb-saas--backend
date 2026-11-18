import mongoose from "mongoose";

const platformSettingsSchema = new mongoose.Schema({
  // Using a singleton pattern with a fixed key
  key: { type: String, default: "global", unique: true },
  
  mainLogoUrl: { type: String, default: "https://storage.googleapis.com/galibrand/superadmin/products/galibrandfullname-logo.png" },

  miniLogoUrl: { type: String, default: "" },
  
  loginImageGrid: {
    type: [String],
    default: []
  },

  // 🔹 COMPANY DETAILS (For Invoices & Contact)
  companyAddress: { type: String, default: "" },
  companyPhone: { type: String, default: "" },
  
  gstNumber: { type: String, default: "" },
  isGstEnabled: { type: Boolean, default: false },
  
  cinNumber: { type: String, default: "" },
  isCinEnabled: { type: Boolean, default: false },

  // 🔹 SUBSCRIPTION INVOICE TEMPLATE (For Store Owners)
  subscriptionInvoiceTemplate: {
    type: String,
    default: `<div style="font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #ddd;">
  <div style="text-align: center; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 20px;">
    <img src="{{mainLogoUrl}}" alt="Galibrand" style="max-height: 50px; margin-bottom: 10px;" />
    <h1 style="color: #333; margin: 0;">TAX INVOICE</h1>
    <p style="margin: 5px 0 0 0; font-size: 14px; color: #555;">{{companyAddress}} | Ph: {{companyPhone}}</p>
    {{gstHtml}}
    {{cinHtml}}
  </div>
  <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
    <div>
      <p style="margin: 2px 0;"><strong>Billed To:</strong></p>
      <p style="margin: 2px 0;">{{storeName}}</p>
      <p style="margin: 2px 0;">{{ownerName}}</p>
      <p style="margin: 2px 0;">{{ownerEmail}}</p>
    </div>
    <div style="text-align: right;">
      <p style="margin: 2px 0;"><strong>Invoice #:</strong> {{invoiceId}}</p>
      <p style="margin: 2px 0;"><strong>Date:</strong> {{purchaseDate}}</p>
      <p style="margin: 2px 0;"><strong>Plan:</strong> {{planName}}</p>
    </div>
  </div>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
    <tr style="background-color: #f8f9fa;"><th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Description</th><th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Plan Price Amount</th></tr>
    <tr><td style="padding: 10px; border: 1px solid #ddd;">{{planName}} Plan Subscription</td><td style="padding: 10px; border: 1px solid #ddd; text-align: right;">₹{{amount}}</td></tr>
  </table>
  <div style="text-align: right;"><h3 style="margin: 0;">Total: ₹{{amount}}</h3></div>
</div>`
  },

  // 🔹 SUBSCRIPTION EXPIRING SOON REMINDER TEMPLATE (e.g. 3, 2, 1 days before expiry)
  subscriptionReminderTemplate: {
    type: String,
    default: `<div style="font-family: Arial, Helvetica, sans-serif; background-color: #f4f7f6; padding: 30px 15px; color: #333333;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
    <div style="background: linear-gradient(135deg, #15803d, #16a34a, #ca8a04); padding: 30px 20px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: bold; letter-spacing: 0.5px;">
        {{platformName}}
      </h1>
      <p style="color: #f0fdf4; margin: 6px 0 0; font-size: 13px;">
        Your Business. Your Brand. Your Digital Store.
      </p>
    </div>
    <div style="padding: 30px 25px;">
      <h2 style="color: #166534; font-size: 20px; margin-top: 0;">
        Hello {{ownerName}},
      </h2>
      <p style="font-size: 15px; line-height: 1.7; color: #4b5563;">
        This is a friendly reminder that the subscription plan for your store
        <strong style="color: #15803d;">{{storeName}}</strong>
        is going to expire in <strong>{{daysLeft}}</strong> on <strong>{{expiryDate}}</strong>.
      </p>
      <div style="background-color: #fff7ed; border-left: 4px solid #f59e0b; padding: 16px; margin: 25px 0; border-radius: 6px;">
        <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
          <strong>Action Required: Renew Your Subscription</strong><br/>
          To avoid any interruption to your store operations and customer orders, please log in to your dashboard and renew before {{expiryDate}}.
        </p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{renewUrl}}" style="background: #15803d; color: #ffffff; padding: 12px 30px; text-decoration: none; font-weight: bold; font-size: 15px; border-radius: 8px; display: inline-block;">
          Renew Subscription Plan &rarr;
        </a>
      </div>
      <p style="font-size: 14px; line-height: 1.6; color: #6b7280;">
        Thank you for choosing <strong style="color: #15803d;">{{platformName}}</strong>. We are proud to support your digital business journey!
      </p>
      <br/>
      <p style="font-size: 14px; color: #4b5563; margin-bottom: 5px;">Best Regards,</p>
      <p style="font-size: 15px; font-weight: bold; color: #15803d; margin-top: 0;">The {{platformName}} Team</p>
    </div>
    <div style="background-color: #f0fdf4; padding: 20px; text-align: center; border-top: 1px solid #dcfce7;">
      <p style="font-size: 13px; color: #166534; margin: 0 0 6px;">Empowering Businesses to Grow Online</p>
      <p style="font-size: 12px; color: #6b7280; margin: 0;">{{companyAddress}} | {{companyPhone}}</p>
    </div>
  </div>
</div>`
  },

  // 🔹 SUBSCRIPTION EXPIRED ALERT TEMPLATE (Store subscription is expired)
  supportNotificationEmail: {
    type: String,
    default: "support@galibrand.cloud"
  },
  createStoreReminderTemplate: {
    type: String,
    default: ""
  },
  subscriptionExpiredTemplate: {
    type: String,
    default: `<div style="font-family: Arial, Helvetica, sans-serif; background-color: #f4f7f6; padding: 30px 15px; color: #333333;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #fecaca; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
    <div style="background: linear-gradient(135deg, #b91c1c, #dc2626, #ea580c); padding: 30px 20px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: bold; letter-spacing: 0.5px;">
        {{platformName}}
      </h1>
      <p style="color: #fee2e2; margin: 6px 0 0; font-size: 13px;">
        Notice: Store Subscription Expired
      </p>
    </div>
    <div style="padding: 30px 25px;">
      <h2 style="color: #991b1b; font-size: 20px; margin-top: 0;">
        Hello {{ownerName}},
      </h2>
      <p style="font-size: 15px; line-height: 1.7; color: #4b5563;">
        The subscription plan for your store
        <strong style="color: #b91c1c;">{{storeName}}</strong>
        expired on <strong style="color: #111827;">{{expiryDate}}</strong>.
      </p>
      <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 25px 0; border-radius: 6px;">
        <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 1.6;">
          <strong>Store Access Restricted</strong><br/>
          Your store is currently suspended and customers cannot view products or place orders until your subscription is renewed.
        </p>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{renewUrl}}" style="background: #dc2626; color: #ffffff; padding: 12px 30px; text-decoration: none; font-weight: bold; font-size: 15px; border-radius: 8px; display: inline-block;">
          Reactivate & Renew Store Now &rarr;
        </a>
      </div>
      <p style="font-size: 14px; line-height: 1.6; color: #6b7280;">
        All your products, categories, orders, and customer data are safely saved. Renewing your plan will instantly restore full access.
      </p>
      <br/>
      <p style="font-size: 14px; color: #4b5563; margin-bottom: 5px;">Best Regards,</p>
      <p style="font-size: 15px; font-weight: bold; color: #991b1b; margin-top: 0;">The {{platformName}} Team</p>
    </div>
    <div style="background-color: #fff1f2; padding: 20px; text-align: center; border-top: 1px solid #fecdd3;">
      <p style="font-size: 13px; color: #9f1239; margin: 0 0 6px;">Empowering Businesses to Grow Online</p>
      <p style="font-size: 12px; color: #6b7280; margin: 0;">{{companyAddress}} | {{companyPhone}}</p>
    </div>
  </div>
</div>`
  }
  
}, { timestamps: true });

export default mongoose.models.PlatformSettings || mongoose.model("PlatformSettings", platformSettingsSchema);
