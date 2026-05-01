/**
 * Encryption/Decryption Utility for Sensitive Data
 * 
 * Handles secure encryption and decryption of sensitive tokens and credentials.
 * Uses AES-256-GCM for authenticated encryption.
 * 
 * Usage:
 * const encrypted = encryptToken(plainText);
 * const decrypted = decryptToken(encrypted);
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const ENCODING = 'hex';

/**
 * Get the encryption key from environment variable
 * Must be exactly 32 bytes (256 bits) for AES-256
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      'ENCRYPTION_KEY not set. Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  
  // Ensure key is exactly 32 bytes
  const keyBuffer = Buffer.from(key, ENCODING);
  if (keyBuffer.length !== 32) {
    throw new Error(`ENCRYPTION_KEY must be 32 bytes (got ${keyBuffer.length})`);
  }
  
  return keyBuffer;
}

/**
 * Encrypt a token or sensitive string
 * Returns a string containing IV and encrypted data
 */
export function encryptToken(plainText: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16); // 128-bit IV for GCM
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plainText, 'utf8', ENCODING);
    encrypted += cipher.final(ENCODING);
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv:encrypted:authTag (all hex encoded)
    return `${iv.toString(ENCODING)}:${encrypted}:${authTag.toString(ENCODING)}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt token');
  }
}

/**
 * Decrypt a token that was encrypted with encryptToken()
 */
export function decryptToken(encryptedText: string): string {
  try {
    const key = getEncryptionKey();
    const parts = encryptedText.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted token format');
    }
    
    const iv = Buffer.from(parts[0], ENCODING);
    const encrypted = parts[1];
    const authTag = Buffer.from(parts[2], ENCODING);
    
    if (iv.length !== 16) {
      throw new Error('Invalid IV length');
    }
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, ENCODING, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt token');
  }
}

/**
 * Generate a webhook secret (for HMAC verification)
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Verify webhook signature using HMAC-SHA256
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Generate HMAC signature for webhook payload
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}
