import express from "express";
import {
  createProduct,
  getProducts,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/")
  .post(protect, createProduct)
  .get(protect, getProducts);

router.route("/:id")
  .put(protect, updateProduct)
  .delete(protect, deleteProduct);

export default router;