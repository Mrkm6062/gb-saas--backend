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
  }
  
}, { timestamps: true });

export default mongoose.models.PlatformSettings || mongoose.model("PlatformSettings", platformSettingsSchema);