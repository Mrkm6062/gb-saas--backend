import mongoose from "mongoose";

const menuItemSchema = new mongoose.Schema({
  label: {
    type: String,
    required: true,
    trim: true,
  },
  url: {
    type: String,
    default: "",
  },
  pageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CustomPage",
    default: null,
  },
  target: {
    type: String,
    enum: ["_self", "_blank"],
    default: "_self",
  },
  order: {
    type: Number,
    default: 0,
  },
  icon: {
    type: String,
    default: "",
  },
  visible: {
    type: Boolean,
    default: true,
  },
});

// Self-nesting for children to support unlimited nesting hierarchy
menuItemSchema.add({
  children: [menuItemSchema],
});

const customMenuSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    menuName: {
      type: String,
      required: true,
      trim: true,
    },
    menuItems: [menuItemSchema],
  },
  { timestamps: true }
);

customMenuSchema.index({ storeId: 1 });

export default mongoose.models.CustomMenu || mongoose.model("CustomMenu", customMenuSchema);
