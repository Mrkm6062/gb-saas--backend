import { storage } from "../gcs.js";
import Store from "../models/Store.js";
import sharp from "sharp";
import DOMPurify from "isomorphic-dompurify";

const bucket = storage.bucket(process.env.GCS_BUCKET);

// UPLOAD IMAGES TO GCS AND CONVERT TO AVIF
export const uploadImages = async (req, res) => {
  try {
    const { storeId } = req.body;
    if (!storeId) return res.status(400).json({ message: "Store ID is required" });

    let storeFolder = "superadmin";
    
    // Only look up the store if it's not a Superadmin global upload
    if (storeId !== "000000000000000000000000") {
      const store = await Store.findById(storeId);
      if (!store) return res.status(404).json({ message: "Store not found" });
      storeFolder = store.storeSlug || store.storeId;
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    // Validate that all uploaded files are strictly images (both MIME and actual content)
    for (const file of req.files) {
      if (!file.mimetype.startsWith('image/')) {
        return res.status(400).json({ message: `Invalid file type: ${file.originalname}. Only image files are allowed.` });
      }

      const isIco = file.originalname.toLowerCase().endsWith('.ico') || file.mimetype === 'image/x-icon' || file.mimetype === 'image/vnd.microsoft.icon';
      
      if (isIco) {
        // Validate ICO magic numbers: First 4 bytes must be 00 00 01 00
        if (file.buffer.length < 4 || file.buffer[0] !== 0 || file.buffer[1] !== 0 || file.buffer[2] !== 1 || file.buffer[3] !== 0) {
          return res.status(400).json({ message: `File ${file.originalname} is a fake or corrupted ICO file.` });
        }
      } else {
        // Deep content check using sharp to ensure it's a real image (catches renamed PDFs/Videos)
        try {
          await sharp(file.buffer).metadata();
        } catch (error) {
          return res.status(400).json({ message: `File ${file.originalname} is not a valid image. It might be a renamed video or document.` });
        }
      }
    }

    const uploadedUrls = [];

    for (const file of req.files) {
      let fileBuffer;
      let contentType;
      let extension;

      const originalName = file.originalname.toLowerCase();

      // Check if file is .ico or .webp
      if (originalName.endsWith('.ico') || file.mimetype === 'image/x-icon' || file.mimetype === 'image/vnd.microsoft.icon') {
        // Skip sharp conversion for .ico as sharp doesn't support it natively
        fileBuffer = file.buffer;
        contentType = 'image/x-icon';
        extension = 'ico';
      } else if (originalName.endsWith('.svg') || file.mimetype === 'image/svg+xml') {
        // Sanitize SVG to prevent XSS while keeping the vector image intact
        const cleanSvg = DOMPurify.sanitize(file.buffer.toString('utf-8'), { USE_PROFILES: { svg: true } });
        fileBuffer = Buffer.from(cleanSvg, 'utf-8');
        contentType = 'image/svg+xml';
        extension = 'svg';
      } else if (originalName.endsWith('.webp') || file.mimetype === 'image/webp') {
        // Optimize but keep as .webp
        fileBuffer = await sharp(file.buffer)
          .webp({ quality: 80 })
          .toBuffer();
        contentType = 'image/webp';
        extension = 'webp';
      } else {
        // Convert other image formats to .webp for wider browser compatibility
        fileBuffer = await sharp(file.buffer)
          .webp({ quality: 80 })
          .toBuffer();
        contentType = 'image/webp';
        extension = 'webp';
      }

      // Use the original filename, replacing spaces with hyphens for safe URLs
      const safeOriginalName = file.originalname.replace(/\s+/g, '-');
      const gcsFilePath = `${storeFolder}/products/${safeOriginalName}`;
      const blob = bucket.file(gcsFilePath);

      await blob.save(fileBuffer, {
        metadata: { 
          contentType: contentType,
          cacheControl: 'public, max-age=3600'
        },
        resumable: false,
      });

      // Encode URI components to handle any special characters in the original name safely
      const publicUrl = `https://storage.googleapis.com/${process.env.GCS_BUCKET}/${encodeURIComponent(gcsFilePath).replace(/%2F/g, '/')}`;
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

    let storeFolder = "superadmin";
    
    // Only look up the store if it's not a Superadmin global query
    if (storeId !== "000000000000000000000000") {
      const store = await Store.findById(storeId);
      if (!store) return res.status(404).json({ message: "Store not found" });
      storeFolder = store.storeSlug || store.storeId;
    }
    const prefix = `${storeFolder}/`;

    const [files] = await bucket.getFiles({ prefix });
    const images = files.map((file) => ({
      name: file.name,
      url: `https://storage.googleapis.com/${process.env.GCS_BUCKET}/${encodeURIComponent(file.name).replace(/%2F/g, '/')}`,
      size: parseInt(file.metadata.size || 0, 10),
      createdAt: file.metadata.timeCreated
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