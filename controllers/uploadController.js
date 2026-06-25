import { storage } from "../gcs.js";
import Store from "../models/Store.js";
import sharp from "sharp";
import { optimize } from "svgo";
import fetch from "node-fetch";

const bucket = storage.bucket(process.env.GCS_BUCKET);

// UPLOAD IMAGES TO GCS AND CONVERT TO AVIF
export const uploadImages = async (req, res) => {
  try {
    const { storeId } = req.body;
    if (!storeId) return res.status(400).json({ message: "Store ID is required" });

    let storeFolder = "superadmin";
    let storageLimitMB = null;
    
    // Only look up the store if it's not a Superadmin global upload
    if (storeId !== "000000000000000000000000") {
      const store = await Store.findById(storeId).populate('planId');
      if (!store) return res.status(404).json({ message: "Store not found" });
      storeFolder = store.storeSlug || store.storeId;
      
      // Determine storage limit from plan or default to 500MB
      storageLimitMB = store.planId?.features?.storageLimit || 500;
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    // Storage limit check for standard stores
    if (storageLimitMB !== null) {
      const limitBytes = storageLimitMB * 1024 * 1024;
      
      // Calculate incoming files size
      const incomingBytes = req.files.reduce((sum, file) => sum + file.size, 0);
      
      // Calculate current used storage in GCS
      const prefix = `${storeFolder}/`;
      const [existingFiles] = await bucket.getFiles({ prefix });
      const currentUsedBytes = existingFiles.reduce((sum, file) => sum + parseInt(file.metadata.size || 0, 10), 0);
      
      if (currentUsedBytes + incomingBytes > limitBytes) {
        return res.status(403).json({ 
          message: `Storage limit exceeded. Your plan allows up to ${storageLimitMB >= 1000 ? storageLimitMB/1000 + 'GB' : storageLimitMB + 'MB'}. Please delete old media or upgrade your plan.` 
        });
      }
    }

    // Validate file sizes and check that all uploaded files are strictly images (both MIME and actual content)
    for (const file of req.files) {
      if (file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ message: `File size too large: ${file.originalname}. Maximum allowed size is 5MB.` });
      }

      if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/')) {
        return res.status(400).json({ message: `Invalid file type: ${file.originalname}. Only image and video files are allowed.` });
      }

      const isIco = file.originalname.toLowerCase().endsWith('.ico') || file.mimetype === 'image/x-icon' || file.mimetype === 'image/vnd.microsoft.icon';
      const isVideo = file.mimetype.startsWith('video/');
      
      if (isIco) {
        // Validate ICO magic numbers: First 4 bytes must be 00 00 01 00
        if (file.buffer.length < 4 || file.buffer[0] !== 0 || file.buffer[1] !== 0 || file.buffer[2] !== 1 || file.buffer[3] !== 0) {
          return res.status(400).json({ message: `File ${file.originalname} is a fake or corrupted ICO file.` });
        }
      } else if (!isVideo && !file.mimetype.startsWith('image/svg')) {
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
      const isVideo = file.mimetype.startsWith('video/');

      if (isVideo) {
        // Skip sharp conversion for videos entirely
        fileBuffer = file.buffer;
        contentType = file.mimetype;
        extension = originalName.split('.').pop() || 'mp4';
      } else if (originalName.endsWith('.ico') || file.mimetype === 'image/x-icon' || file.mimetype === 'image/vnd.microsoft.icon') {
        // Skip sharp conversion for .ico
        fileBuffer = file.buffer;
        contentType = 'image/x-icon';
        extension = 'ico';
      } else if (originalName.endsWith('.svg') || file.mimetype === 'image/svg+xml') {
        // Optimize and sanitize SVG using SVGO (Bypasses PM2 jsdom ESM conflict)
        const result = optimize(file.buffer.toString('utf-8'), {
          multipass: true,
          plugins: [
            {
              name: 'preset-default',
              params: { overrides: { removeViewBox: false } },
            },
            'removeScriptElement',
          ],
        });
        const cleanSvg = result.data;
        fileBuffer = Buffer.from(cleanSvg, 'utf-8');
        contentType = 'image/svg+xml';
        extension = 'svg';
      } else {
        // Convert all other image formats to WebP for fast compression while keeping original size (dimensions)
        let sharpInstance = sharp(file.buffer);
        const type = req.body.type || 'product';

        let quality = 80;
        if (type === 'logo') {
          quality = 90;
        } else if (type === 'favicon' || type === 'icon') {
          quality = 85;
        } else if (type === 'banner') {
          quality = 80;
        }

        fileBuffer = await sharpInstance
          .webp({ quality: quality })
          .toBuffer();

        // If compressed image is still larger than 2MB, compress with slightly lower quality, but still keep original resolution
        if (fileBuffer.length > 2 * 1024 * 1024) {
          fileBuffer = await sharp(file.buffer)
            .webp({ quality: Math.max(55, quality - 15) })
            .toBuffer();
        }
        contentType = 'image/webp';
        extension = 'webp';
      }

      // Ensure the extension matches the new format
      const safeBaseName = file.originalname.replace(/\.[^/.]+$/, "").replace(/\s+/g, '-');
      const gcsFilePath = `${storeFolder}/media/${safeBaseName}-${Date.now()}.${extension}`;
      const blob = bucket.file(gcsFilePath);

      await blob.save(fileBuffer, {
        metadata: { 
          contentType: contentType,
          cacheControl: 'public, max-age=31536000, immutable'
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

// PROXY DOWNLOAD FOR IMAGES (Bypasses CORS restrictions on browser downloads)
export const proxyDownload = async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ message: "URL is required" });

    // Validate that the domain is storage.googleapis.com to prevent SSRF
    if (!url.includes("storage.googleapis.com")) {
      return res.status(403).json({ message: "Access forbidden. Only storage.googleapis.com URLs are permitted." });
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch image from storage.");

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    
    const filename = url.substring(url.lastIndexOf('/') + 1) || 'download.avif';
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // Stream the image file body directly to the client
    response.body.pipe(res);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};