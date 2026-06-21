import { storage } from "../gcs.js";
import sharp from "sharp";

const bucket = storage.bucket(process.env.GCS_BUCKET);
const activeGenerations = new Map(); // cacheKey -> Promise

// GET /api/images/*?w=300
export const optimizeImage = async (req, res) => {
  let relativePath = req.params[0];
  const widthStr = req.query.w;

  try {
    if (!relativePath) {
      return res.status(400).json({ message: "Image path is required" });
    }

    // Clean up double slashes or leading slashes if any
    relativePath = relativePath.replace(/^\/+/, "");

    // Parse requested width (we support 80, 160, 186, 56, 323, 600)
    let width = parseInt(widthStr, 10);
    const whitelistedWidths = [80, 160, 186, 56, 323, 600];
    if (isNaN(width) || !whitelistedWidths.includes(width)) {
      // If width is invalid or not whitelisted, redirect to original public GCS image
      const originalUrl = `https://storage.googleapis.com/${process.env.GCS_BUCKET}/${relativePath}`;
      return res.redirect(originalUrl);
    }

    // Naming convention: e.g. path/to/image.jpg -> path/to/image-w300.webp
    const lastDotIndex = relativePath.lastIndexOf(".");
    let basePath = relativePath;
    let originalExt = "";
    
    if (lastDotIndex !== -1) {
      basePath = relativePath.substring(0, lastDotIndex);
      originalExt = relativePath.substring(lastDotIndex + 1);
    }

    const optimizedPath = `${basePath}-w${width}.webp`;

    const originalFile = bucket.file(relativePath);
    const optimizedFile = bucket.file(optimizedPath);

    // Helper to stream file from GCS with cache headers
    const streamFile = async (file) => {
      const [metadata] = await file.getMetadata();
      
      // Cache settings: 1 year, immutable
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("Content-Type", "image/webp");
      
      if (metadata.etag) {
        res.setHeader("ETag", metadata.etag);
        
        // Handle ETag match / 304 Not Modified
        const clientETag = req.headers["if-none-match"];
        if (clientETag === metadata.etag) {
          return res.status(304).end();
        }
      }
      
      file.createReadStream().pipe(res);
    };

    // 1. Check if optimized version exists in GCS
    const [optimizedExists] = await optimizedFile.exists();
    if (optimizedExists) {
      await streamFile(optimizedFile);
      return;
    }

    // 2. Prevent duplicate image generation using a lock/promise cache
    const cacheKey = `${relativePath}_w${width}`;
    let generationPromise = activeGenerations.get(cacheKey);

    if (!generationPromise) {
      generationPromise = (async () => {
        // Recheck existence within the lock/promise
        const [existsAgain] = await optimizedFile.exists();
        if (existsAgain) return;

        // Check if original file exists in GCS
        const [originalExists] = await originalFile.exists();
        if (!originalExists) {
          throw new Error("Original image does not exist in storage");
        }

        // Download original image to memory
        const [originalBuffer] = await originalFile.download();

        // Determine target dimensions
        let targetWidth = width;
        let targetHeight = width;
        let fit = "cover";
        let quality = 80;

        if (width === 80) { // Logo
          targetWidth = 80;
          targetHeight = 40;
          fit = "inside";
          quality = 85;
        } else if (width === 160) { // High-DPI Logo
          targetWidth = 160;
          targetHeight = 80;
          fit = "inside";
          quality = 85;
        } else if (width === 186) { // Category
          targetWidth = 186;
          targetHeight = 186;
          quality = 80;
        } else if (width === 56) { // Icon
          targetWidth = 56;
          targetHeight = 56;
          quality = 85;
        } else if (width === 323) { // Product Card
          targetWidth = 323;
          targetHeight = 425;
          quality = 80;
        } else if (width === 600) { // Product Details
          targetWidth = 600;
          targetHeight = 789;
          quality = 80;
        }

        // Perform image resizing and webp conversion using Sharp
        const optimizedBuffer = await sharp(originalBuffer)
          .resize({
            width: targetWidth,
            height: targetHeight,
            fit: fit,
            withoutEnlargement: true
          })
          .webp({ quality: quality })
          .toBuffer();

        // Save the optimized version to GCS
        await optimizedFile.save(optimizedBuffer, {
          metadata: {
            contentType: "image/webp",
            cacheControl: "public, max-age=31536000, immutable"
          },
          resumable: false
        });
      })();

      activeGenerations.set(cacheKey, generationPromise);
      try {
        await generationPromise;
      } finally {
        activeGenerations.delete(cacheKey);
      }
    } else {
      // Wait for the active generation to complete
      await generationPromise;
    }

    // 3. Stream the newly generated file
    await streamFile(optimizedFile);

  } catch (error) {
    console.error("Image optimization error:", error);
    // Safe fallback: redirect to the original file in GCS
    try {
      const originalUrl = `https://storage.googleapis.com/${process.env.GCS_BUCKET}/${relativePath}`;
      return res.redirect(originalUrl);
    } catch (e) {
      res.status(500).json({ message: "Failed to optimize or fetch original image" });
    }
  }
};
