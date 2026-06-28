import mongoose from "mongoose";

const newsletterTemplateSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true },
  name: { type: String, required: true },
  subject: { type: String, required: true },
  htmlContent: { type: String, required: true }, // html/css format
  designJson: { type: String } // optional drag & drop representation
}, {
  timestamps: true
});

export default mongoose.models.NewsletterTemplate || mongoose.model("NewsletterTemplate", newsletterTemplateSchema);
