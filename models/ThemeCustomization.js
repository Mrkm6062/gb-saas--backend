import mongoose from "mongoose";

const themeCustomizationSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },
    themeId: {
      type: String,
      required: true,
      index: true,
    },
    global: {
      primaryColor: { type: String, default: "#22c55e" },
      secondaryColor: { type: String, default: "#f97316" },
      fontFamily: { type: String, default: "Poppins" },
      borderRadius: { type: String, default: "12px" },
      officialfaviconimage: { type: String, default: "" },
      metaTitle: { type: String, default: "" },
      metaDescription: { type: String, default: "" },
    },
    header: {
      bgColor: { type: String, default: "#ffffff" },
      textColor: { type: String, default: "#000000" },
      officialdesktopLogo: { type: String, default: "" },
      officialmobileLogo: { type: String, default: "" },
      offerBanner: {
        Enabled: { type: Boolean, default: true },
        text: { type: String, default: "Free delivery on orders above ₹500!" },
        bgColor: { type: String, default: "#22c55e" },
        textColor: { type: String, default: "#ffffff" },
      },
    },
    banner: {
      bgColor: { type: String, default: "#f5f5f5" },
      textColor: { type: String, default: "#111111" },
      limit: { type: Number, default: 5 },
    },
    category: {
      bgColor: { type: String, default: "#ffffff" },
    },
    productCard: {
      bgColor: { type: String, default: "#ffffff" },
      borderColor: { type: String, default: "#e5e7eb" },
    },
    footer: {
      bgColor: { type: String, default: "#111827" },
      textColor: { type: String, default: "#ffffff" },
      officialdesktopLogo: { type: String, default: "" },
      officialmobileLogo: { type: String, default: "" },
        description: { type: String, default: "© 2024 Your Store. All rights reserved." },
        newsletter: {
          enabled: { type: Boolean, default: false },
          placeholder: { type: String, default: "Enter your email" },
          buttonText: { type: String, default: "Subscribe" },
        },
        
    },
    whyChooseUs: {
      enabled: { type: Boolean, default: true},

      title: { type: String, default: "Why Choose Us" },

      subtitle: { type: String, default: ""},

      items: [
       {
          title: { type: String, required: true },
          description: { type: String, default: "" },
          icon: { type: String, default: "" },
          image: { type: String,default: "" },
          isActive: { type: Boolean, default: true },
          sortOrder: { type: Number, default: 0 }
        }
  ]
}
  },
  { timestamps: true }
);

// Ensure that each store has only one customization document per theme
themeCustomizationSchema.index({ storeId: 1, themeId: 1 }, { unique: true });

export default mongoose.models.ThemeCustomization ||
  mongoose.model("ThemeCustomization", themeCustomizationSchema);