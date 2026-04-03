const prisma = require('../config/database');
const logger = require('../utils/logger');

/**
 * Helper to ensure userId is an integer
 */
const toIntUserId = (userId) => {
  return typeof userId === 'string' ? parseInt(userId, 10) : userId;
};

/**
 * Get user credentials by user ID
 */
const getUserCredentials = async (userId) => {
  const credentials = await prisma.userCredentials.findUnique({
    where: { user_id: toIntUserId(userId) }
  });

  return credentials;
};

/**
 * Get Telegram credentials for a user
 */
const getTelegramCredentials = async (userId) => {
  const creds = await getUserCredentials(userId);

  if (!creds || !creds.telegram_api_id || !creds.telegram_api_hash) {
    return null;
  }

  return {
    apiId: creds.telegram_api_id,
    apiHash: creds.telegram_api_hash,
    phone: creds.telegram_phone,
    session: creds.telegram_session
  };
};

/**
 * Get AI credentials for a user
 */
const getAICredentials = async (userId) => {
  const creds = await getUserCredentials(userId);

  if (!creds || !creds.ai_api_key) {
    return null;
  }

  return {
    provider: creds.ai_provider || 'groq',
    apiKey: creds.ai_api_key
  };
};

/**
 * Save Telegram credentials for a user
 */
const saveTelegramCredentials = async (userId, apiId, apiHash, phone) => {
  const userIdInt = toIntUserId(userId);
  const credentials = await prisma.userCredentials.upsert({
    where: { user_id: userIdInt },
    update: {
      telegram_api_id: apiId,
      telegram_api_hash: apiHash,
      telegram_phone: phone,
      updated_at: new Date()
    },
    create: {
      user_id: userIdInt,
      telegram_api_id: apiId,
      telegram_api_hash: apiHash,
      telegram_phone: phone
    }
  });

  logger.info(`Telegram credentials saved for user ${userId}`);
  return credentials;
};

/**
 * Save Telegram session for a user
 */
const saveTelegramSession = async (userId, session) => {
  const userIdInt = toIntUserId(userId);
  const credentials = await prisma.userCredentials.upsert({
    where: { user_id: userIdInt },
    update: {
      telegram_session: session,
      bot_active: true,
      updated_at: new Date()
    },
    create: {
      user_id: userIdInt,
      telegram_session: session,
      bot_active: true
    }
  });

  logger.info(`Telegram session saved for user ${userId}`);
  return credentials;
};

/**
 * Save AI credentials for a user
 */
const saveAICredentials = async (userId, apiKey, provider = 'groq') => {
  const userIdInt = toIntUserId(userId);
  const credentials = await prisma.userCredentials.upsert({
    where: { user_id: userIdInt },
    update: {
      ai_api_key: apiKey,
      ai_provider: provider,
      updated_at: new Date()
    },
    create: {
      user_id: userIdInt,
      ai_api_key: apiKey,
      ai_provider: provider
    }
  });

  logger.info(`AI credentials saved for user ${userId}`);
  return credentials;
};

/**
 * Clear Telegram credentials for a user
 */
const clearTelegramCredentials = async (userId) => {
  const userIdInt = toIntUserId(userId);
  const credentials = await prisma.userCredentials.upsert({
    where: { user_id: userIdInt },
    update: {
      telegram_api_id: null,
      telegram_api_hash: null,
      telegram_phone: null,
      telegram_session: null,
      bot_active: false,
      updated_at: new Date()
    },
    create: {
      user_id: userIdInt,
      bot_active: false
    }
  });

  logger.info(`Telegram credentials cleared for user ${userId}`);
  return credentials;
};

/**
 * Clear AI credentials for a user
 */
const clearAICredentials = async (userId) => {
  const userIdInt = toIntUserId(userId);
  const credentials = await prisma.userCredentials.upsert({
    where: { user_id: userIdInt },
    update: {
      ai_api_key: null,
      ai_provider: 'groq',
      updated_at: new Date()
    },
    create: {
      user_id: userIdInt
    }
  });

  logger.info(`AI credentials cleared for user ${userId}`);
  return credentials;
};

/**
 * Check if user has Telegram configured
 */
const hasTelegramConfig = async (userId) => {
  const creds = await getUserCredentials(userId);
  return !!(creds && creds.telegram_api_id && creds.telegram_api_hash && creds.telegram_phone);
};

/**
 * Check if user has Telegram session (bot is connected)
 */
const hasTelegramSession = async (userId) => {
  const creds = await getUserCredentials(userId);
  return !!(creds && creds.telegram_session);
};

/**
 * Check if user has AI configured
 */
const hasAIConfig = async (userId) => {
  const creds = await getUserCredentials(userId);
  return !!(creds && creds.ai_api_key);
};

/**
 * Update bot active status
 */
const updateBotActive = async (userId, active) => {
  const userIdInt = toIntUserId(userId);
  const credentials = await prisma.userCredentials.upsert({
    where: { user_id: userIdInt },
    update: { bot_active: active, updated_at: new Date() },
    create: { user_id: userIdInt, bot_active: active }
  });

  return credentials;
};

/**
 * Get credentials status (masked info)
 */
const getCredentialsStatus = async (userId) => {
  const creds = await getUserCredentials(userId);

  if (!creds) {
    return { telegram: null, ai: null, botActive: false };
  }

  const hasTelegram = creds.telegram_api_id && creds.telegram_api_hash && creds.telegram_phone;
  const hasSession = creds.telegram_session;

  return {
    telegram: hasTelegram ? {
      configured: true,
      connected: hasSession,
      phone: creds.telegram_phone || 'N/A',
      apiId: creds.telegram_api_id ? `${creds.telegram_api_id}`.substring(0, 4) + '****' : null
    } : null,
    ai: creds.ai_api_key ? {
      configured: true,
      provider: creds.ai_provider || 'groq',
      keyPreview: creds.ai_api_key.substring(0, 8) + '...' + creds.ai_api_key.substring(creds.ai_api_key.length - 4)
    } : null,
    botActive: creds.bot_active || false
  };
};

module.exports = {
  getUserCredentials,
  getTelegramCredentials,
  getAICredentials,
  saveTelegramCredentials,
  saveTelegramSession,
  saveAICredentials,
  clearTelegramCredentials,
  clearAICredentials,
  hasTelegramConfig,
  hasTelegramSession,
  hasAIConfig,
  updateBotActive,
  getCredentialsStatus
};