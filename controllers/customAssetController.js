import { storage } from "../gcs.js";
import CustomAsset from "../models/CustomAsset.js";
import Store from "../models/Store.js";

const bucket = storage.bucket(process.env.GCS_BUCKET);

const verifyStoreOwner = async (storeId, userId, role) => {
  const storeQuery = { _id: storeId };
  if (role !== "superadmin") {
    storeQuery.ownerId = userId;
  }
  const store = await Store.findOne(storeQuery);
  return store;
};

// UPLOAD ASSET(S) TO GCS
export const uploadAsset = async (req, res) => {
  try {
    const { storeId } = req.body;
    const folder = req.body.folder || "media"; // Default folder
    
    if (!storeId) {
      return res.status(400).json({ message: "Store ID is required" });
    }

    const store = await verifyStoreOwner(storeId, req.user.userId, req.user.role);
    if (!store) {
      return res.status(403).json({ message: "Unauthorized store access" });
    }

    // Get files from request
    const files = req.files || (req.file ? [req.file] : []);
    if (files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const storeFolder = store.storeSlug || store.storeId.toString();
    const uploadedAssets = [];

    // Allowable MIME type groups
    const allowedMimeGroups = {
      image: ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"],
      font: ["font/ttf", "font/otf", "font/woff", "font/woff2", "application/font-woff", "application/font-sfnt", "application/vnd.ms-fontobject"],
      video: ["video/mp4", "video/webm", "video/ogg"],
      css: ["text/css"],
      js: ["application/javascript", "text/javascript", "application/ecmascript"]
    };

    // Flatten for easy validation check
    const allowedMimes = Object.values(allowedMimeGroups).flat();

    for (const file of files) {
      const mime = file.mimetype.toLowerCase();

      // Check if file extension/mime matches allowed assets
      const isValidMime = allowedMimes.includes(mime) || 
        file.originalname.endsWith(".css") || 
        file.originalname.endsWith(".js") || 
        file.originalname.endsWith(".woff") || 
        file.originalname.endsWith(".woff2") || 
        file.originalname.endsWith(".ttf") || 
        file.originalname.endsWith(".otf");

      if (!isValidMime) {
        return res.status(400).json({
          message: `File type '${file.mimetype}' not allowed. Only images, fonts, videos, CSS, and JS are permitted.`
        });
      }

      // Size checks: images/CSS/JS (5MB limit), videos/fonts (20MB limit)
      const isLargeAsset = mime.startsWith("video/") || mime.startsWith("font/") || file.originalname.match(/\.(woff|woff2|ttf|otf|mp4|webm)$/i);
      const maxSize = isLargeAsset ? 20 * 1024 * 1024 : 5 * 1024 * 1024;
      if (file.size > maxSize) {
        return res.status(400).json({
          message: `File size too large: ${file.originalname}. Max size allowed is ${isLargeAsset ? "20MB" : "5MB"}.`
        });
      }
    }

    for (const file of files) {
      let mimeType = file.mimetype;
      // Force correct MIME type for specific custom developer files if express fails to detect
      if (file.originalname.endsWith(".css")) mimeType = "text/css";
      if (file.originalname.endsWith(".js")) mimeType = "application/javascript";
      if (file.originalname.endsWith(".woff")) mimeType = "font/woff";
      if (file.originalname.endsWith(".woff2")) mimeType = "font/woff2";

      const originalName = file.originalname.replace(/\s+/g, "-");
      const safeBaseName = originalName.replace(/\.[^/.]+$/, "");
      const extension = originalName.split(".").pop();
      const gcsFileName = `${storeFolder}/custom-builder/${folder}/${safeBaseName}-${Date.now()}.${extension}`;

      const blob = bucket.file(gcsFileName);
      await blob.save(file.buffer, {
        metadata: {
          contentType: mimeType,
          cacheControl: "public, max-age=31536000, immutable",
        },
        resumable: false,
      });

      const publicUrl = `https://storage.googleapis.com/${process.env.GCS_BUCKET}/${encodeURIComponent(gcsFileName).replace(/%2F/g, "/")}`;

      // Save database record
      const asset = await CustomAsset.create({
        storeId,
        fileName: file.originalname,
        url: publicUrl,
        mimeType,
        size: file.size,
        folder,
        uploadedBy: req.user._id,
      });

      uploadedAssets.push(asset);
    }

    res.status(200).json({ message: "Assets uploaded successfully", assets: uploadedAssets });
  } catch (error) {
    console.error("Asset upload error:", error);
    res.status(500).json({ message: error.message });
  }
};

// LIST ASSETS
export const listAssets = async (req, res) => {
  try {
    const { storeId, folder, mimeType, search } = req.query;
    if (!storeId) {
      return res.status(400).json({ message: "Store ID is required" });
    }

    const isOwner = await verifyStoreOwner(storeId, req.user.userId, req.user.role);
    if (!isOwner) {
      return res.status(403).json({ message: "Unauthorized store access" });
    }

    const query = { storeId };

    if (folder) {
      query.folder = folder;
    }

    if (mimeType) {
      query.mimeType = { $regex: mimeType, $options: "i" };
    }

    if (search) {
      query.fileName = { $regex: search, $options: "i" };
    }

    const assets = await CustomAsset.find(query).sort({ createdAt: -1 });
    res.json(assets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE ASSET
export const deleteAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const asset = await CustomAsset.findById(id);
    if (!asset) {
      return res.status(404).json({ message: "Asset record not found" });
    }

    const isOwner = await verifyStoreOwner(asset.storeId, req.user.userId, req.user.role);
    if (!isOwner) {
      return res.status(403).json({ message: "Unauthorized store access" });
    }

    // Extract path from public GCS URL: https://storage.googleapis.com/bucketName/path/to/file.ext
    // Need to parse out path after the bucketName
    const bucketPrefix = `https://storage.googleapis.com/${process.env.GCS_BUCKET}/`;
    if (asset.url.startsWith(bucketPrefix)) {
      const gcsFilePath = decodeURIComponent(asset.url.replace(bucketPrefix, ""));
      try {
        await bucket.file(gcsFilePath).delete();
      } catch (err) {
        console.warn(`File not found in GCS for asset: ${gcsFilePath}. Proceeding to delete Mongoose record.`);
      }
    }

    await asset.deleteOne();
    res.json({ message: "Asset deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
