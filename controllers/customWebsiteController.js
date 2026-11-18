import { storage } from "../gcs.js";
import Store from "../models/Store.js";
import path from "path";

const bucket = storage.bucket(process.env.GCS_BUCKET);

// Verify user has ownership of the target store
const verifyStoreOwner = async (storeIdentifier, user) => {
  if (!storeIdentifier || storeIdentifier === "undefined" || storeIdentifier === "null") {
    return null;
  }
  const cleanId = String(storeIdentifier).trim();
  const isMongoId = /^[0-9a-fA-F]{24}$/.test(cleanId);

  const idQuery = isMongoId
    ? [{ _id: cleanId }, { storeId: cleanId }, { storeSlug: cleanId }]
    : [{ storeId: cleanId }, { storeSlug: cleanId }];

  // SuperAdmin has full bypass access
  if (user && user.role === "superadmin") {
    return await Store.findOne({ $or: idQuery });
  }

  // Build all possible owner IDs (both custom string userId and Mongo _id)
  const possibleOwnerIds = [
    user?.userId,
    user?._id,
    user?._id ? String(user._id) : null,
    user?.userId ? String(user.userId) : null
  ].filter(Boolean);

  const store = await Store.findOne({
    $and: [
      { $or: idQuery },
      { ownerId: { $in: possibleOwnerIds } }
    ]
  });

  if (!store) {
    console.warn(`[CustomWebsite] Ownership check failed for storeIdentifier: "${storeIdentifier}"`, {
      userId: user?.userId,
      _id: user?._id,
      role: user?.role
    });
  }

  return store;
};

// MIME type lookup
const getMimeType = (filePath) => {
  const ext = path.extname(filePath || "").toLowerCase();
  const mimeMap = {
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".eot": "application/vnd.ms-fontobject",
    ".txt": "text/plain; charset=utf-8",
    ".xml": "application/xml",
    ".pdf": "application/pdf",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".map": "application/json; charset=utf-8",
  };
  return mimeMap[ext] || "application/octet-stream";
};

// Disallow dangerous executable extensions
const disallowedExtensions = [
  ".exe", ".bat", ".cmd", ".sh", ".bash", ".php", ".py", ".rb", ".pl", ".cgi", ".env", ".htaccess"
];

// Helper to normalize and strip root folder prefix if all files reside in a single subfolder
const sanitizePaths = (files, rawPaths) => {
  let paths = [];

  if (Array.isArray(rawPaths)) {
    paths = rawPaths;
  } else if (typeof rawPaths === "string") {
    try {
      const parsed = JSON.parse(rawPaths);
      if (Array.isArray(parsed)) paths = parsed;
      else paths = [rawPaths];
    } catch {
      paths = [rawPaths];
    }
  }

  const cleaned = files.map((file, idx) => {
    let p = (paths[idx] || file.originalname || "file").trim();
    // Normalize slashes
    p = p.replace(/\\/g, "/");
    // Strip leading slashes and drive letters
    p = p.replace(/^[a-zA-Z]:/, "").replace(/^\/+/, "");
    // Remove directory traversal
    p = p.replace(/\.\.\//g, "").replace(/\.\//g, "");
    return p;
  });

  // Check if all files share a common root directory prefix (e.g., 'build/index.html' -> 'index.html')
  const segmentsList = cleaned.map((p) => p.split("/"));
  const firstSegments = segmentsList.map((s) => s[0]);
  const allShareFirst =
    firstSegments.length > 0 &&
    firstSegments.every((s) => s === firstSegments[0]) &&
    segmentsList.every((s) => s.length > 1);

  if (allShareFirst) {
    return cleaned.map((p) => p.split("/").slice(1).join("/"));
  }

  return cleaned;
};

// @desc    Upload multiple files or folder for custom website
// @route   POST /api/custom-website/upload
// @access  Private (Store Owner)
export const uploadWebsiteFiles = async (req, res) => {
  try {
    const { storeId } = req.body;
    if (!storeId) {
      return res.status(400).json({ message: "Store ID is required." });
    }

    const store = await verifyStoreOwner(storeId, req.user);
    if (!store) {
      return res.status(403).json({ message: "Unauthorized store access." });
    }

    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ message: "No files selected for upload." });
    }

    const storeFolder = store.storeSlug || store.storeId;
    const sanitizedPaths = sanitizePaths(files, req.body.paths);

    // Validate disallowed extensions
    for (const relPath of sanitizedPaths) {
      const ext = path.extname(relPath).toLowerCase();
      if (disallowedExtensions.includes(ext)) {
        return res.status(400).json({
          message: `File '${relPath}' has a prohibited extension (${ext}). Executables and script files are not allowed.`
        });
      }
    }

    let hasIndex = false;
    let uploadedCount = 0;

    // Upload each file to GCS
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relPath = sanitizedPaths[i];
      if (!relPath) continue;

      if (relPath.toLowerCase() === "index.html" || relPath.toLowerCase() === "index.htm") {
        hasIndex = true;
      }

      const isHtml = relPath.toLowerCase().endsWith(".html") || relPath.toLowerCase().endsWith(".htm");
      const gcsPath = `${storeFolder}/custom-website/${relPath}`;
      const contentType = getMimeType(relPath);
      const blob = bucket.file(gcsPath);

      await blob.save(file.buffer, {
        metadata: {
          contentType: contentType,
          cacheControl: isHtml ? "no-cache, no-store, must-revalidate" : "public, max-age=3600",
        },
        resumable: false,
      });

      uploadedCount++;
    }

    // Get current total files and size in GCS under custom-website/
    const prefix = `${storeFolder}/custom-website/`;
    const [existingFiles] = await bucket.getFiles({ prefix });
    const totalFiles = existingFiles.length;
    const totalSizeBytes = existingFiles.reduce(
      (sum, f) => sum + parseInt(f.metadata.size || 0, 10),
      0
    );

    const hasIndexInBucket = existingFiles.some((f) => {
      const rel = f.name.replace(prefix, "").toLowerCase();
      return rel === "index.html" || rel === "index.htm";
    });

    // Update store customWebsite info
    store.customWebsite = {
      enabled: true,
      entryPoint: hasIndexInBucket ? "index.html" : (store.customWebsite?.entryPoint || "index.html"),
      filesCount: totalFiles,
      totalSizeBytes: totalSizeBytes,
      updatedAt: new Date(),
    };

    await store.save();

    const publicBaseUrl = `https://storage.googleapis.com/${process.env.GCS_BUCKET}/${storeFolder}/custom-website/`;
    const entryUrl = `${publicBaseUrl}${store.customWebsite.entryPoint || 'index.html'}`;

    res.status(200).json({
      success: true,
      message: `Successfully uploaded ${uploadedCount} file(s) for your custom website!`,
      uploadedCount,
      totalFiles,
      totalSizeBytes,
      hasIndex: hasIndexInBucket,
      publicBaseUrl,
      entryUrl,
      customWebsite: store.customWebsite,
    });
  } catch (error) {
    console.error("[CustomWebsite] Upload error:", error);
    res.status(500).json({ message: error.message || "Failed to upload website files." });
  }
};

// @desc    List all uploaded custom website files
// @route   GET /api/custom-website/files
// @access  Private (Store Owner)
export const getWebsiteFiles = async (req, res) => {
  try {
    const { storeId } = req.query;
    if (!storeId) {
      return res.status(400).json({ message: "Store ID is required." });
    }

    const store = await verifyStoreOwner(storeId, req.user);
    if (!store) {
      return res.status(403).json({ message: "Unauthorized store access." });
    }

    const storeFolder = store.storeSlug || store.storeId;
    const prefix = `${storeFolder}/custom-website/`;
    const [files] = await bucket.getFiles({ prefix });

    let hasIndex = false;
    let totalSizeBytes = 0;

    const fileList = files
      .map((f) => {
        const relPath = f.name.replace(prefix, "");
        if (!relPath) return null; // Skip folder marker

        const size = parseInt(f.metadata.size || 0, 10);
        totalSizeBytes += size;

        if (relPath.toLowerCase() === "index.html" || relPath.toLowerCase() === "index.htm") {
          hasIndex = true;
        }

        const publicUrl = `https://storage.googleapis.com/${process.env.GCS_BUCKET}/${encodeURIComponent(f.name).replace(/%2F/g, "/")}`;

        return {
          name: path.basename(relPath),
          path: relPath,
          size: size,
          contentType: f.metadata.contentType || getMimeType(relPath),
          updatedAt: f.metadata.updated,
          url: publicUrl,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.path.localeCompare(b.path));

    const publicBaseUrl = `https://storage.googleapis.com/${process.env.GCS_BUCKET}/${storeFolder}/custom-website/`;
    const entryUrl = `${publicBaseUrl}index.html`;

    // Keep store document in sync with actual bucket contents
    if (store.customWebsite?.filesCount !== fileList.length) {
      store.customWebsite = {
        enabled: fileList.length > 0,
        entryPoint: hasIndex ? "index.html" : "index.html",
        filesCount: fileList.length,
        totalSizeBytes: totalSizeBytes,
        updatedAt: store.customWebsite?.updatedAt || new Date(),
      };
      await store.save();
    }

    res.status(200).json({
      success: true,
      files: fileList,
      totalFiles: fileList.length,
      totalSizeBytes,
      hasIndex,
      publicBaseUrl,
      entryUrl,
      customWebsite: store.customWebsite,
      store: {
        storeId: store.storeId,
        storeName: store.storeName,
        storeSlug: store.storeSlug,
        subdomain: store.subdomain,
      },
    });
  } catch (error) {
    console.error("[CustomWebsite] List error:", error);
    res.status(500).json({ message: error.message || "Failed to list website files." });
  }
};

// @desc    Delete a specific file from custom website
// @route   DELETE /api/custom-website/file
// @access  Private (Store Owner)
export const deleteWebsiteFile = async (req, res) => {
  try {
    const { storeId, filePath } = req.body;
    if (!storeId || !filePath) {
      return res.status(400).json({ message: "Store ID and filePath are required." });
    }

    const store = await verifyStoreOwner(storeId, req.user);
    if (!store) {
      return res.status(403).json({ message: "Unauthorized store access." });
    }

    const storeFolder = store.storeSlug || store.storeId;
    const cleanPath = filePath.replace(/\\/g, "/").replace(/^\/+/, "");
    const gcsPath = `${storeFolder}/custom-website/${cleanPath}`;

    const file = bucket.file(gcsPath);
    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
    }

    // Refresh count in store document
    const prefix = `${storeFolder}/custom-website/`;
    const [remaining] = await bucket.getFiles({ prefix });
    const hasIndex = remaining.some((f) => {
      const rel = f.name.replace(prefix, "").toLowerCase();
      return rel === "index.html" || rel === "index.htm";
    });
    const totalSizeBytes = remaining.reduce((s, f) => s + parseInt(f.metadata.size || 0, 10), 0);

    store.customWebsite = {
      enabled: remaining.length > 0,
      entryPoint: hasIndex ? "index.html" : "index.html",
      filesCount: remaining.length,
      totalSizeBytes: totalSizeBytes,
      updatedAt: new Date(),
    };
    await store.save();

    res.status(200).json({
      success: true,
      message: `File '${cleanPath}' deleted successfully.`,
      remainingFiles: remaining.length,
      hasIndex,
    });
  } catch (error) {
    console.error("[CustomWebsite] Delete error:", error);
    res.status(500).json({ message: error.message || "Failed to delete website file." });
  }
};

// @desc    Delete all custom website files
// @route   DELETE /api/custom-website/all
// @access  Private (Store Owner)
export const deleteEntireWebsite = async (req, res) => {
  try {
    const { storeId } = req.body;
    if (!storeId) {
      return res.status(400).json({ message: "Store ID is required." });
    }

    const store = await verifyStoreOwner(storeId, req.user);
    if (!store) {
      return res.status(403).json({ message: "Unauthorized store access." });
    }

    const storeFolder = store.storeSlug || store.storeId;
    const prefix = `${storeFolder}/custom-website/`;

    await bucket.deleteFiles({ prefix, force: true });

    store.customWebsite = {
      enabled: false,
      entryPoint: "index.html",
      filesCount: 0,
      totalSizeBytes: 0,
      updatedAt: new Date(),
    };
    await store.save();

    res.status(200).json({
      success: true,
      message: "All custom website files have been deleted successfully.",
    });
  } catch (error) {
    console.error("[CustomWebsite] Delete all error:", error);
    res.status(500).json({ message: error.message || "Failed to delete custom website." });
  }
};

// @desc    Public proxy to serve custom website files directly from store domain
// @route   GET /api/custom-website/public/serve/*
// @access  Public
export const servePublicWebsiteFile = async (req, res) => {
  try {
    if (!req.store) {
      return res.status(404).json({ message: "Store not found." });
    }

    const storeFolder = req.store.storeSlug || req.store.storeId;
    let requestedPath = req.params[0] || req.query.path || "index.html";

    // Normalize
    requestedPath = requestedPath.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!requestedPath || requestedPath === "/") {
      requestedPath = "index.html";
    }

    const gcsPath = `${storeFolder}/custom-website/${requestedPath}`;
    let file = bucket.file(gcsPath);
    let [exists] = await file.exists();

    // If file without extension is requested (clean URLs e.g. /about), try appending .html
    if (!exists && !path.extname(requestedPath)) {
      const htmlPath = `${storeFolder}/custom-website/${requestedPath}.html`;
      const htmlFile = bucket.file(htmlPath);
      const [htmlExists] = await htmlFile.exists();
      if (htmlExists) {
        file = htmlFile;
        exists = true;
        requestedPath = `${requestedPath}.html`;
      }
    }

    // SPA fallback: if not found, fall back to index.html
    if (!exists) {
      const indexPath = `${storeFolder}/custom-website/index.html`;
      const indexFile = bucket.file(indexPath);
      const [indexExists] = await indexFile.exists();
      if (indexExists) {
        file = indexFile;
        exists = true;
        requestedPath = "index.html";
      }
    }

    if (!exists) {
      return res.status(404).send(`<!DOCTYPE html><html><head><title>File Not Found</title></head><body style="font-family: sans-serif; text-align: center; padding: 50px;"><h2>Custom Website File Not Found</h2><p>Requested path: <code>${requestedPath}</code></p></body></html>`);
    }

    const contentType = getMimeType(requestedPath);
    const isHtml = requestedPath.endsWith(".html") || requestedPath.endsWith(".htm");
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", isHtml ? "no-cache, no-store, must-revalidate" : "public, max-age=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const readStream = file.createReadStream();
    readStream.on("error", (err) => {
      console.error("[CustomWebsite] Read stream error:", err);
      if (!res.headersSent) {
        res.status(500).send("Error reading file.");
      }
    });

    readStream.pipe(res);
  } catch (error) {
    console.error("[CustomWebsite] Serve error:", error);
    res.status(500).json({ message: error.message });
  }
};
