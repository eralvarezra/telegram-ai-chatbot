const crypto = require('crypto');
const logger = require('./logger');

// Get encryption key from environment (must be 32 bytes = 64 hex chars for AES-256)
const getEncryptionKey = () => {
  const key = process.env.API_KEY_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('API_KEY_ENCRYPTION_KEY environment variable is not set');
  }
  if (key.length !== 64) {
    throw new Error('API_KEY_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  return Buffer.from(key, 'hex');
};

/**
 * Encrypt API key using AES-256-GCM
 * @param {string} plainText - The API key to encrypt
 * @returns {{ encrypted: string, iv: string }} - Encrypted data and IV
 */
const encryptApiKey = (plainText) => {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16); // 16 bytes for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Combine encrypted data with auth tag
    const encryptedData = encrypted + authTag.toString('hex');

    return {
      encrypted: encryptedData,
      iv: iv.toString('hex')
    };
  } catch (error) {
    logger.error('Error encrypting API key:', error);
    throw new Error('Failed to encrypt API key');
  }
};

/**
 * Decrypt API key using AES-256-GCM
 * @param {string} encryptedData - The encrypted API key (includes auth tag)
 * @param {string} ivHex - The initialization vector in hex
 * @returns {string} - Decrypted API key
 */
const decryptApiKey = (encryptedData, ivHex) => {
  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');

    // Extract auth tag (last 16 bytes in hex = 32 characters)
    const authTag = Buffer.from(encryptedData.slice(-32), 'hex');
    const encrypted = encryptedData.slice(0, -32);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error('Error decrypting API key:', error);
    throw new Error('Failed to decrypt API key');
  }
};

/**
 * Validate API key format based on provider
 * @param {string} apiKey - The API key to validate
 * @param {string} provider - The provider ('openai' or 'groq')
 * @returns {boolean} - Whether the key format is valid
 */
const validateApiKeyFormat = (apiKey, provider) => {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }

  // Check minimum length
  if (apiKey.length < 20) {
    return false;
  }

  switch (provider) {
    case 'openai':
      // OpenAI keys start with 'sk-' and are typically 51+ characters
      return apiKey.startsWith('sk-') && apiKey.length >= 40;

    case 'groq':
      // Groq keys start with 'gsk_' and are typically 52+ characters
      return apiKey.startsWith('gsk_') && apiKey.length >= 40;

    default:
      // Unknown provider - accept any reasonably long key
      return apiKey.length >= 20;
  }
};

/**
 * Mask API key for display (show first 4 and last 4 characters)
 * @param {string} apiKey - The API key to mask
 * @returns {string} - Masked API key
 */
const maskApiKey = (apiKey) => {
  if (!apiKey || apiKey.length < 12) {
    return '****';
  }

  const start = apiKey.slice(0, 4);
  const end = apiKey.slice(-4);
  const middle = '*'.repeat(Math.min(apiKey.length - 8, 20));

  return `${start}${middle}${end}`;
};

module.exports = {
  encryptApiKey,
  decryptApiKey,
  validateApiKeyFormat,
  maskApiKey
};