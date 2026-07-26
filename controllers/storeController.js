import Store from "../models/Store.js";
import Counter from "../models/Counter.js";
import Plan from "../models/Plan.js";
import Domain from "../models/Domain.js";
import { storage } from "../gcs.js";
import Theme from "../models/Theme.js";
import User from "../models/User.js";
import SuperAdminStaff from "../models/SuperAdminStaff.js";
import PlatformSettings from "../models/PlatformSettings.js";
import StoreHours from "../models/StoreHours.js";
import nodemailer from "nodemailer";
import CustomPage from "../models/CustomPage.js";
import Pwa from "../models/Pwa.js";

// Nodemailer transporter for system emails (Welcome & Renewals)
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// VERIFY EMPLOYEE ID (Used by frontend during store creation)
export const verifyEmployee = async (req, res) => {
  try {
    const { empId } = req.body;
    if (!empId) return res.status(400).json({ message: "Employee ID is required." });
    
    const staff = await SuperAdminStaff.findOne({ EmployeeId: empId });
    if (!staff) return res.status(404).json({ message: "Invalid Employee ID." });
    if (staff.Suspended) return res.status(400).json({ message: "This Employee ID is currently suspended." });
    
    res.json({ name: staff.name });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// CREATE NEW STORE
export const createStore = async (req, res) => {
  try {
    const { name, storeType, metaDescription, planId, empId } = req.body;

    // Prevent undefined.toLowerCase() crash
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ message: "A valid store name is required" });
    }

    // Generate unique subdomain based on name (e.g., "My Store" -> "mystore")
    const storeSlug = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const storeExists = await Store.findOne({ storeSlug });

    if (storeExists) {
      return res.status(400).json({ message: "Store name is already taken. Try another." });
    }

    // Validate Employee ID if provided
    if (empId) {
      const staff = await SuperAdminStaff.findOne({ EmployeeId: empId });
      if (!staff) {
        return res.status(400).json({ message: "Invalid Employee ID provided." });
      }
      if (staff.Suspended) {
        return res.status(400).json({ message: "This Employee ID is currently suspended and cannot assist." });
      }
    }

    // Safely generate Store Code using an atomic counter to prevent race conditions
    const counter = await Counter.findOneAndUpdate(
      { _id: 'storeId' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const storeId = `GBS${String(counter.seq).padStart(3, '0')}`;

    // As per new requirement for the first-time store creation:
    // The first 7 days are a trial period.
    // The plan's official start date is after the trial.
    // The plan's expiry is 1 month after the official start date.
    const trialPlanDays = 7;
    const planStartDate = new Date();
    planStartDate.setDate(planStartDate.getDate() + trialPlanDays);

    const planExpiryDate = new Date(planStartDate);
    planExpiryDate.setMonth(planExpiryDate.getMonth() + 1);

    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: "Unauthorized. User context is missing." });
    }

    const existingStores = await Store.find({ ownerId: req.user.userId, isDeleted: { $ne: true } });
    if (existingStores.length >= 1) {
      return res.status(403).json({ message: "Store limit reached. You can only create 1 store per account. Please create a new account for another store." });
    }

    const store = await Store.create({
      storeName: name,
      storeSlug,
      subdomain: `${storeSlug}.galibrand.cloud`,
      storeId,
      ownerId: req.user.userId, // Attached securely by the 'protect' middleware
      storeType,
      empID: empId,
      metaDescription,
      status: 'active',
      planId: planId || null,
      planStartDate,
      planExpiryDate,
      isTrialActive: true,
      trialPlanDays,
      theme: 'default-theme'
    });

    // Seed default homepage for Custom Website store types
    if (storeType === "Custom Website(HTML,CSS,JS)") {
      try {
        await CustomPage.create({
          storeId: store._id,
          title: "Homepage",
          slug: "home",
          pageType: "custom",
          description: "Welcome to your new website.",
          isHomepage: true,
          isPublished: true,
          status: "published",
          bodyHTML: `<!-- Welcome Page -->\n<div style="max-width: 600px; margin: 4rem auto; padding: 2.5rem; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; font-family: system-ui, sans-serif;">\n  <h1 style="color: #0f172a;">Welcome to your new website</h1>\n  <p style="color: #475569;">This is a custom webpage created using HTML, CSS, and JS. You can edit this page directly in your Store Dashboard under Website Builder.</p>\n</div>`,
          customCSS: `/* Custom page CSS styling */\nbody {\n  background: #f1f5f9;\n  margin: 0;\n}`,
          customJS: `// Custom page JS logic\nconsole.log("Homepage loaded.");`,
          seo: {
            metaTitle: name + " - Welcome",
            metaDescription: "Welcome to our custom website.",
            robots: "index, follow"
          }
        });
      } catch (err) {
        console.error("Failed to seed default custom homepage:", err);
      }
    }

    // Create default 24x7 store hours
    try {
      const defaultDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
      await StoreHours.create({
        storeId: store._id,
        mode: "24x7",
        timezone: "Asia/Kolkata",
        weeklySchedule: defaultDays.map(day => ({
          day,
          enabled: true,
          slots: [{ open: "00:00", close: "23:59" }]
        })),
        holidays: [],
        specialHours: [],
        temporaryClosure: { enabled: false, reason: "", startDate: null, endDate: null },
        displayStoreStatus: true
      });
    } catch (err) {
      console.error("Failed to create default store hours", err);
    }

    // Send Welcome & Trial Details Email
    try {
      const user = await User.findOne({ userId: req.user.userId });
      if (user && user.email) {
        await transporter.sendMail({
          from: `"Galibrand Cloud" <${process.env.EMAIL_USER}>`,
          to: user.email,
          subject: `Welcome to Galibrand! Your store ${store.storeName} is ready`,
          html: `
            <div style="font-family: sans-serif; padding: 20px;">
              <h2>Hello ${user.name},</h2>
              <p>Congratulations! Your store <strong>${store.storeName}</strong> has been created successfully.</p>
              <p>Your <strong>${trialPlanDays}-day free trial</strong> is now active and will end on <strong>${planStartDate.toDateString()}</strong>.</p>
              <p>After your trial ends, your first billing cycle will expire on <strong>${planExpiryDate.toDateString()}</strong>.</p>
              <p>Log in to your dashboard to start adding products and customizing your storefront!</p>
              <br/>
              <p>Best Regards,</p>
              <p>The Galibrand Cloud Team</p>
            </div>
          `
        });
      }
    } catch (emailErr) {
      console.error("Failed to send welcome email:", emailErr.message);
    }

    res.status(201).json({ message: "Store created successfully!", store });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE STORE DETAILS (Logo, Favicon, Title, etc.)
export const updateStore = async (req, res) => {
  try {
    const { id } = req.params; // Can be MongoDB _id or custom storeId (e.g., GBS001)
    const { storeName, websiteTitle, logo, favicon, banner, storeType, theme, supportPhoneNumbers, supportEmail, locationAddress, mapLocation, whatsappNumber, whatsappSupportEnabled } = req.body;

    // Ensure the store belongs to the authenticated user
    const query = { ownerId: req.user.userId };
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      query._id = id;
    } else {
      query.storeId = id;
    }
    query.isDeleted = { $ne: true };

    const store = await Store.findOne(query);

    if (!store) {
      return res.status(404).json({ message: "Store not found or unauthorized" });
    }

    // Update fields if they are provided in the request payload
    if (storeName !== undefined) store.storeName = storeName;
    if (websiteTitle !== undefined) store.websiteTitle = websiteTitle;
    if (logo !== undefined) store.logo = logo;
    if (favicon !== undefined) store.favicon = favicon;
    if (banner !== undefined) store.banner = banner;
    if (storeType !== undefined) store.storeType = storeType;
    if (theme !== undefined) {
      const themeDoc = await Theme.findOne({ themeId: theme });
      // Check if it's a paid theme and if the user has purchased it.
      if (themeDoc && themeDoc.type === 'paid') {
        const hasPurchased = store.paidThemes?.some(pt => pt.themeId === theme);
        if (!hasPurchased) return res.status(403).json({ message: "You have not purchased this theme. Please purchase it to apply." });
      }
      store.theme = theme;
    }
    if (supportPhoneNumbers !== undefined) store.supportPhoneNumbers = supportPhoneNumbers;
    if (supportEmail !== undefined) store.supportEmail = supportEmail;
    if (locationAddress !== undefined) store.locationAddress = locationAddress;
    if (mapLocation !== undefined) store.mapLocation = mapLocation;
    if (whatsappNumber !== undefined) store.whatsappNumber = whatsappNumber;
    if (whatsappSupportEnabled !== undefined) store.whatsappSupportEnabled = whatsappSupportEnabled;

    await store.save();

    res.json({ message: "Store updated successfully!", store });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPGRADE STORE PLAN (User protected)
export const upgradeStorePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { planId } = req.body;

    // Ensure the store belongs to the authenticated user
    const store = await Store.findOne({ _id: id, ownerId: req.user.userId, isDeleted: { $ne: true } });
    if (!store) {
      return res.status(404).json({ message: "Store not found or unauthorized" });
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: "Selected plan not found" });
    }

    // Apply the new plan
    store.planId = planId;
    store.subscriptionStatus = 'active';
    store.isTrialActive = false;
    store.planStartDate = new Date();
    store.planExpiryDate = new Date(new Date().setDate(new Date().getDate() + 30)); // Adds 30 days

    const invoiceId = `INV-${Date.now().toString().slice(-6).toUpperCase()}`;
    store.billingHistory.push({
      planId: plan._id,
      planName: plan.name,
      amount: plan.price,
      date: new Date(),
      transactionId: "FREE_PLAN_UPGRADE",
      invoiceId
    });

    await store.save();

    // Send Repurchase / Upgrade Email
    try {
      const user = await User.findOne({ userId: req.user.userId });
      if (user && user.email) {
        // Fetch the global platform settings for the invoice template
        const settings = await PlatformSettings.findOne({ key: "global" });
        let invoiceHtml = '';
        
        if (settings && settings.subscriptionInvoiceTemplate) {
          const gstHtml = settings.isGstEnabled && settings.gstNumber ? `<p style="margin: 2px 0; font-size: 12px; color: #666;">GSTIN: ${settings.gstNumber}</p>` : '';
          const cinHtml = settings.isCinEnabled && settings.cinNumber ? `<p style="margin: 2px 0; font-size: 12px; color: #666;">CIN: ${settings.cinNumber}</p>` : '';
          
          invoiceHtml = settings.subscriptionInvoiceTemplate
            .replace(/{{storeName}}/g, store.storeName)
            .replace(/{{ownerName}}/g, user.name)
            .replace(/{{ownerEmail}}/g, user.email)
            .replace(/{{invoiceId}}/g, invoiceId)
            .replace(/{{purchaseDate}}/g, new Date().toLocaleDateString())
            .replace(/{{planName}}/g, plan.name)
            .replace(/{{amount}}/g, plan.price)
            .replace(/{{mainLogoUrl}}/g, settings.mainLogoUrl || 'https://placehold.co/200x50?text=Logo')
            .replace(/{{companyAddress}}/g, settings.companyAddress || "")
            .replace(/{{companyPhone}}/g, settings.companyPhone || "")
            .replace(/{{gstHtml}}/g, gstHtml)
            .replace(/{{cinHtml}}/g, cinHtml);
        }

        await transporter.sendMail({
          from: `"Galibrand Cloud" <${process.env.EMAIL_USER}>`,
          to: user.email,
          subject: `Subscription Renewed & Invoice - ${store.storeName}`,
          html: invoiceHtml || `
            <div style="font-family: sans-serif; padding: 20px;">
              <h2>Hello ${user.name},</h2>
              <p>Thank you for your purchase! The subscription plan for your store <strong>${store.storeName}</strong> has been successfully upgraded/renewed to the <strong>${plan.name}</strong> plan.</p>
              <p>Your new plan expiry date is <strong>${store.planExpiryDate.toDateString()}</strong>.</p>
              <p>We appreciate your business!</p>
              <br/>
              <p>Best Regards,</p>
              <p>The Galibrand Cloud Team</p>
            </div>
          `
        });
      }
    } catch (emailErr) {
      console.error("Failed to send subscription renewal email:", emailErr.message);
    }

    res.json({ message: "Plan upgraded successfully!", store });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET CURRENT STORE
export const getMyStore = async (req, res) => {
  try {
    // Find all stores owned by the user (including soft-deleted for the recycle bin)
    const stores = await Store.find({ ownerId: req.user.userId }).populate('planId').lean();
    
    const domains = await Domain.find({
      storeId: { $in: stores.map(s => s._id) },
      status: 'connected'
    }).lean();

    const storesWithDomains = stores.map(store => {
      const customDomain = domains.find(d => d.storeId.toString() === store._id.toString());
      const planDetails = store.planId && typeof store.planId === 'object' ? store.planId : null;
      const planIdStr = planDetails ? planDetails._id.toString() : store.planId;
      return { 
        ...store, 
        planId: planIdStr,
        planDetails,
        customDomain: customDomain ? customDomain.domain : null 
      };
    });

    // Always return a 200 OK with the stores array, even if empty
    res.json({ stores: storesWithDomains });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// RESTORE DELETED STORE
export const restoreStore = async (req, res) => {
  try {
    const { id } = req.params;
    const store = await Store.findOneAndUpdate(
      { _id: id, ownerId: req.user.userId, isDeleted: true },
      { isDeleted: false, deletedAt: null, status: 'active' },
      { new: true }
    );
    
    if (!store) {
      return res.status(404).json({ message: "Store not found or unauthorized" });
    }

    res.json({ message: "Store restored successfully.", store });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE STORE EXPIRY (SUPERADMIN)
export const updateStoreExpiry = async (req, res) => {
  try {
    const { planExpiryDate } = req.body;
    const store = await Store.findById(req.params.id);
    
    if (!store) return res.status(404).json({ message: "Store not found" });

    store.planExpiryDate = new Date(planExpiryDate);
    // If the new date is in the future, automatically reactivate their subscription
    if (store.planExpiryDate > new Date()) {
      store.subscriptionStatus = 'active';
    }
    
    await store.save();
    res.json({ message: "Expiry date updated", store });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE STORE STATUS (SUPERADMIN)
export const updateStoreStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const store = await Store.findById(req.params.id);
    
    if (!store) return res.status(404).json({ message: "Store not found" });

    store.status = status;
    await store.save();
    
    res.json({ message: "Store status updated", store });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET STORE BY SUBDOMAIN (PUBLIC)
export const getStoreBySubdomain = async (req, res) => {
  try {
    const { subdomain } = req.params;

    const store = await Store.findOne({ storeSlug: subdomain, isDeleted: { $ne: true } });

    if (!store) {
      return res.status(404).json({ message: "Store not found" });
    }

    res.json(store);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET RESOLVED STORE DATA (Public Storefront)
export const getStoreData = async (req, res) => {
  try {
    if (!req.store || req.store.isDeleted) {
      return res.status(404).json({ message: "Store not found" });
    }
    
    let storeObj = req.store.toObject ? req.store.toObject() : { ...req.store };
    
    if (storeObj.theme) {
      const themeDoc = await Theme.findOne({ themeId: storeObj.theme });
      if (themeDoc && themeDoc.themeFolder) {
        storeObj.themeFolder = themeDoc.themeFolder;
      }
    }

    // Attach PWA settings dynamically from MongoDB
    const pwaSettings = await Pwa.findOne({ storeId: req.store._id });
    if (pwaSettings) {
      storeObj.pwa = {
        enabled: pwaSettings.enabled,
        appName: pwaSettings.appName,
        shortName: pwaSettings.shortName,
        themeColor: pwaSettings.themeColor,
        backgroundColor: pwaSettings.backgroundColor,
        icon192: pwaSettings.icon192,
        icon512: pwaSettings.icon512
      };
    } else {
      storeObj.pwa = { enabled: false };
    }

    res.json(storeObj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE STORE
export const deleteStore = async (req, res) => {
  try {
    const { id } = req.params;
    const store = await Store.findOneAndUpdate(
      { _id: id, ownerId: req.user.userId, isDeleted: { $ne: true } },
      { isDeleted: true, deletedAt: new Date(), status: 'suspended' },
      { new: true }
    );
    
    if (!store) {
      return res.status(404).json({ message: "Store not found or unauthorized" });
    }

    res.json({ message: "Store moved to recycle bin. It will be permanently deleted in 30 days." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};