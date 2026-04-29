import { storage } from "../gcs.js";
import Store from "../models/Store.js";
import sharp from "sharp";

const bucket = storage.bucket(process.env.GCS_BUCKET);

// UPLOAD IMAGES TO GCS AND CONVERT TO AVIF
export const uploadImages = async (req, res) => {
  try {
    const { storeId } = req.body;
    if (!storeId) return res.status(400).json({ message: "Store ID is required" });

    const store = await Store.findById(storeId);
    if (!store) return res.status(404).json({ message: "Store not found" });

    const storeFolder = store.storeSlug || store.storeId;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const uploadedUrls = [];

    for (const file of req.files) {
      // Convert image to AVIF format
      const avifBuffer = await sharp(file.buffer)
        .avif({ quality: 80 })
        .toBuffer();

      const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.avif`;
      const gcsFilePath = `${storeFolder}/products/${filename}`;
      const blob = bucket.file(gcsFilePath);

      await blob.save(avifBuffer, {
        metadata: { contentType: "image/avif" },
        resumable: false,
      });

      const publicUrl = `https://storage.googleapis.com/${process.env.GCS_BUCKET}/${gcsFilePath}`;
      uploadedUrls.push(publicUrl);
    }

    res.status(200).json({ urls: uploadedUrls });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ message: error.message });
  }
};

// LIST ALL IMAGES FOR A STORE
export const listImages = async (req, res) => {
  try {
    const { storeId } = req.query;
    if (!storeId) return res.status(400).json({ message: "Store ID is required" });

    const store = await Store.findById(storeId);
    if (!store) return res.status(404).json({ message: "Store not found" });

    const storeFolder = store.storeSlug || store.storeId;
    const prefix = `${storeFolder}/`;

    const [files] = await bucket.getFiles({ prefix });
    const images = files.map((file) => ({
      name: file.name,
      url: `https://storage.googleapis.com/${process.env.GCS_BUCKET}/${file.name}`,
    }));

    res.status(200).json({ images });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE AN IMAGE FROM GCS
export const deleteImage = async (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ message: "Filename is required" });

    await bucket.file(filename).delete();
    res.status(200).json({ message: "Image deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};