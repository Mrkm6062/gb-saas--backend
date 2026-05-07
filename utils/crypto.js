import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// IMPORTANT: This key MUST be 32 characters long and stored securely in your .env file.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
  console.error('CRITICAL: ENCRYPTION_KEY environment variable is missing or not 32 characters long.');
  // In a real app, you might want to throw an error to prevent startup
  // throw new Error('ENCRYPTION_KEY environment variable must be a 32-character string.');
}

export const encrypt = (text) => {
  if (text === null || typeof text === 'undefined' || !ENCRYPTION_KEY) {
    return text;
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Combine iv, authTag, and encrypted data into a single string for storage
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
};

export const decrypt = (hash) => {
  if (hash === null || typeof hash === 'undefined' || !ENCRYPTION_KEY) {
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
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (error) {
    console.error("Decryption failed. The key may be corrupted or the ENCRYPTION_KEY is wrong.", error);
    return null; // Return null on failure to prevent using a corrupted value
  }
};