import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Get the raw key from environment variables
const RAW_KEY = process.env.ENCRYPTION_KEY;

// Ensure the key is exactly 32 bytes long to prevent "Invalid key length" errors.
let ENCRYPTION_KEY_BUFFER;
if (RAW_KEY) {
  if (Buffer.from(RAW_KEY).length === 32) {
    ENCRYPTION_KEY_BUFFER = Buffer.from(RAW_KEY);
  } else {
    // If not exactly 32 bytes, derive a 32-byte key using SHA-256 hash
    ENCRYPTION_KEY_BUFFER = crypto.createHash('sha256').update(RAW_KEY).digest();
  }
}

export const encrypt = (text) => {
  if (text === null || typeof text === 'undefined' || !ENCRYPTION_KEY_BUFFER) {
    return text;
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY_BUFFER, iv);
  
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Combine iv, authTag, and encrypted data into a single string for storage
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
};

export const decrypt = (hash) => {
  if (hash === null || typeof hash === 'undefined' || !ENCRYPTION_KEY_BUFFER) {
    return hash;
  }
  
  const parts = hash.split(':');
  // If it's not our encrypted format, return it as is (might be an old, unencrypted key)
  if (parts.length !== 3) {
    return hash;
  }
  
  try {
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY_BUFFER, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (error) {
    console.error("Decryption failed. The key may be corrupted or the ENCRYPTION_KEY is wrong.", error);
    return null; // Return null on failure to prevent using a corrupted value
  }
};