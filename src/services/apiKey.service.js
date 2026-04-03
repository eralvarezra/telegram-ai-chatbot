const prisma = require('../config/database');
const { encryptApiKey, decryptApiKey, validateApiKeyFormat, maskApiKey } = require('../utils/encryption');
const { ApiKeyError } = require('../utils/errors');
const logger = require('../utils/logger');
const OpenAI = require('openai');

/**
 * Get the appropriate API key for a user based on their plan
 * @param {number} userId - The user ID
 * @returns {Promise<{ apiKey: string, provider: string, keyType: string }>}
 */
const getApiKeyForUser = async (userId) => {
  const platformKey = process.env.PLATFORM_GROQ_KEY || process.env.AI_API_KEY;

  // Get user info
  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      user_api_key: true,
      user_api_key_iv: true,
      user_api_provider: true
    }
  });

  // If user not found, check for platform key
  if (!user) {
    if (platformKey) {
      logger.debug(`User ${userId} not found, using platform key as fallback`);
      return {
        apiKey: platformKey,
        provider: 'groq',
        keyType: 'platform'
      };
    }
    throw new ApiKeyError('User not found. Please log in again.');
  }

  // Premium users ALWAYS use platform key
  if (user.plan === 'premium') {
    if (!platformKey) {
      throw new ApiKeyError('Platform API key not configured. Contact support.');
    }
    logger.debug(`Using platform key for premium user ${userId}`);
    return {
      apiKey: platformKey,
      provider: 'groq',
      keyType: 'platform'
    };
  }

  // Free users must have their own key
  if (!user.user_api_key || !user.user_api_key_iv) {
    // During onboarding, allow platform key temporarily for free users
    // This allows them to complete personality setup before adding their own key
    if (platformKey) {
      logger.debug(`Free user ${userId} has no key, using platform key temporarily`);
      return {
        apiKey: platformKey,
        provider: 'groq',
        keyType: 'platform_temp'
      };
    }
    throw new ApiKeyError('API key required. Please add your Groq API key in Settings.');
  }

  try {
    const decryptedKey = decryptApiKey(user.user_api_key, user.user_api_key_iv);
    logger.debug(`Using user's own API key for free user ${userId}`);
    return {
      apiKey: decryptedKey,
      provider: user.user_api_provider || 'groq',
      keyType: 'user'
    };
  } catch (error) {
    logger.error('Error decrypting user API key:', error);
    throw new ApiKeyError('Failed to decrypt API key. Please re-add your key.');
  }
};

/**
 * Save user's API key (encrypted)
 * @param {number} userId - The user ID
 * @param {string} apiKey - The API key to save
 * @param {string} provider - The provider ('openai' or 'groq')
 * @returns {Promise<{ success: boolean, keyPreview: string }>}
 */
const saveUserApiKey = async (userId, apiKey, provider = 'groq') => {
  // Validate format
  if (!validateApiKeyFormat(apiKey, provider)) {
    throw new ApiKeyError(`Invalid API key format for ${provider}. Expected format: ${provider === 'openai' ? 'sk-...' : 'gsk_...'}`);
  }

  // Validate key works by making a test call
  const isValid = await validateApiKey(apiKey, provider);
  if (!isValid) {
    throw new ApiKeyError('API key validation failed. Please check your key and try again.');
  }

  // Encrypt and save
  const { encrypted, iv } = encryptApiKey(apiKey);

  await prisma.adminUser.update({
    where: { id: userId },
    data: {
      user_api_key: encrypted,
      user_api_key_iv: iv,
      user_api_provider: provider
    }
  });

  logger.info(`API key saved for user ${userId}`);

  return {
    success: true,
    keyPreview: maskApiKey(apiKey)
  };
};

/**
 * Remove user's API key
 * @param {number} userId - The user ID
 * @returns {Promise<{ success: boolean }>}
 */
const removeUserApiKey = async (userId) => {
  await prisma.adminUser.update({
    where: { id: userId },
    data: {
      user_api_key: null,
      user_api_key_iv: null,
      user_api_provider: null
    }
  });

  logger.info(`API key removed for user ${userId}`);

  return { success: true };
};

/**
 * Get API key status (masked)
 * @param {number} userId - The user ID
 * @returns {Promise<{ hasKey: boolean, keyPreview?: string, provider?: string, isValid?: boolean }>}
 */
const getApiKeyStatus = async (userId) => {
  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      user_api_key: true,
      user_api_key_iv: true,
      user_api_provider: true
    }
  });

  if (!user) {
    throw new ApiKeyError('User not found');
  }

  // Premium users don't need personal key
  if (user.plan === 'premium') {
    return {
      hasKey: true,
      keyPreview: '**** (platform)',
      provider: process.env.PLATFORM_GROQ_KEY ? 'groq' : 'openai',
      isValid: true,
      plan: 'premium'
    };
  }

  // Free users need their own key
  if (!user.user_api_key) {
    return {
      hasKey: false,
      plan: 'free'
    };
  }

  // Decrypt to get preview (never return full key)
  try {
    const decryptedKey = decryptApiKey(user.user_api_key, user.user_api_key_iv);
    return {
      hasKey: true,
      keyPreview: maskApiKey(decryptedKey),
      provider: user.user_api_provider || 'groq',
      isValid: true,
      plan: 'free'
    };
  } catch (error) {
    logger.error('Error decrypting API key for status:', error);
    return {
      hasKey: true,
      keyPreview: '**** (error)',
      provider: user.user_api_provider,
      isValid: false,
      plan: 'free'
    };
  }
};

/**
 * Validate API key by making a test call
 * @param {string} apiKey - The API key to validate
 * @param {string} provider - The provider
 * @returns {Promise<boolean>}
 */
const validateApiKey = async (apiKey, provider) => {
  try {
    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: provider === 'groq' ? 'https://api.groq.com/openai/v1' : undefined
    });

    // Make a minimal request to validate the key
    // Use a very small model and minimal tokens
    await client.chat.completions.create({
      model: provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 1
    });

    return true;
  } catch (error) {
    // Check if it's an auth error vs other errors
    if (error.status === 401 || error.status === 403) {
      logger.warn('API key validation failed - invalid key');
      return false;
    }
    // Rate limit or other errors mean key is valid but something else is wrong
    if (error.status === 429) {
      logger.info('API key valid but rate limited');
      return true;
    }
    logger.error('API key validation error:', error.message);
    return false;
  }
};

/**
 * Update user plan
 * @param {number} userId - The user ID
 * @param {string} plan - The plan ('free' or 'premium')
 * @returns {Promise<{ success: boolean, plan: string }>}
 */
const updateUserPlan = async (userId, plan) => {
  if (!['free', 'premium'].includes(plan)) {
    throw new ApiKeyError('Invalid plan. Must be "free" or "premium"');
  }

  await prisma.adminUser.update({
    where: { id: userId },
    data: { plan }
  });

  logger.info(`User ${userId} plan updated to ${plan}`);

  return { success: true, plan };
};

module.exports = {
  getApiKeyForUser,
  saveUserApiKey,
  removeUserApiKey,
  getApiKeyStatus,
  validateApiKey,
  updateUserPlan,
  validateApiKeyFormat,
  maskApiKey
};