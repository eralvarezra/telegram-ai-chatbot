const prisma = require('../config/database');
const logger = require('../utils/logger');
const botInstanceService = require('./botInstance.service');

const getSetupStatus = async () => {
  let setup = await prisma.appSetup.findUnique({ where: { id: 1 } });

  if (!setup) {
    setup = await prisma.appSetup.create({
      data: { id: 1 }
    });
    logger.info('Created new setup record');
  }

  // Check if setup is complete
  const isComplete = setup.setup_completed ||
    (setup.telegram_api_id && setup.telegram_api_hash && setup.telegram_session && setup.ai_api_key);

  return {
    ...setup,
    isComplete,
    needsTelegram: !setup.telegram_api_id || !setup.telegram_api_hash || !setup.telegram_session,
    needsAI: !setup.ai_api_key,
    currentStep: setup.current_step || 'welcome'
  };
};

const saveTelegramCredentials = async (apiId, apiHash, phone) => {
  const setup = await prisma.appSetup.upsert({
    where: { id: 1 },
    update: {
      telegram_api_id: apiId,
      telegram_api_hash: apiHash,
      telegram_phone: phone,
      current_step: 'ai'
    },
    create: {
      id: 1,
      telegram_api_id: apiId,
      telegram_api_hash: apiHash,
      telegram_phone: phone,
      current_step: 'ai'
    }
  });

  logger.info('Telegram credentials saved');
  return setup;
};

const saveTelegramSession = async (session) => {
  const setup = await prisma.appSetup.update({
    where: { id: 1 },
    data: {
      telegram_session: session,
      setup_completed: true,
      current_step: 'complete'
    }
  });

  logger.info('Telegram session saved');
  return setup;
};

const saveAICredentials = async (apiKey, provider = 'groq') => {
  const setup = await prisma.appSetup.upsert({
    where: { id: 1 },
    update: {
      ai_api_key: apiKey,
      ai_provider: provider,
      current_step: 'config'
    },
    create: {
      id: 1,
      ai_api_key: apiKey,
      ai_provider: provider,
      current_step: 'config'
    }
  });

  logger.info('AI credentials saved');
  return setup;
};

const getTelegramCredentials = async () => {
  const setup = await prisma.appSetup.findUnique({ where: { id: 1 } });

  if (!setup || !setup.telegram_api_id || !setup.telegram_api_hash) {
    return null;
  }

  return {
    apiId: setup.telegram_api_id,
    apiHash: setup.telegram_api_hash,
    phone: setup.telegram_phone,
    session: setup.telegram_session
  };
};

const getAICredentials = async () => {
  const setup = await prisma.appSetup.findUnique({ where: { id: 1 } });

  if (setup && setup.ai_api_key) {
    logger.debug('getAICredentials: Using database credentials');
    return {
      provider: setup.ai_provider || 'groq',
      apiKey: setup.ai_api_key
    };
  }

  // Fallback to environment variables
  const envApiKey = process.env.AI_API_KEY || process.env.PLATFORM_GROQ_KEY;
  if (envApiKey) {
    logger.debug(`getAICredentials: Using env var, key: ${envApiKey.substring(0, 15)}...`);
    return {
      provider: 'groq',
      apiKey: envApiKey
    };
  }

  logger.warn('getAICredentials: No API key found in database or env vars');
  return null;
};

// Clear Telegram credentials (unlink)
const clearTelegramCredentials = async () => {
  const setup = await prisma.appSetup.update({
    where: { id: 1 },
    data: {
      telegram_api_id: null,
      telegram_api_hash: null,
      telegram_phone: null,
      telegram_session: null,
      setup_completed: false,
      current_step: 'telegram'
    }
  });

  // Reset bot instance ID so users get fresh conversations when reconnected
  botInstanceService.resetBotInstanceId();

  logger.info('Telegram credentials cleared (unlinked)');
  return setup;
};

// Clear AI credentials (unlink)
const clearAICredentials = async () => {
  const setup = await prisma.appSetup.update({
    where: { id: 1 },
    data: {
      ai_api_key: null,
      ai_provider: 'groq',
      current_step: 'ai'
    }
  });

  logger.info('AI credentials cleared (unlinked)');
  return setup;
};

// Get credentials status (masked info)
const getCredentialsStatus = async () => {
  const setup = await prisma.appSetup.findUnique({ where: { id: 1 } });

  if (!setup) {
    return { telegram: null, ai: null };
  }

  // Telegram is considered configured if apiId, apiHash, and phone are present
  // It's "connected" if session also exists
  const hasTelegramConfig = setup.telegram_api_id && setup.telegram_api_hash && setup.telegram_phone;
  const hasTelegramSession = setup.telegram_session;

  return {
    telegram: hasTelegramConfig ? {
      connected: hasTelegramSession,
      configured: true,
      phone: setup.telegram_phone || 'N/A',
      apiId: setup.telegram_api_id ? `${setup.telegram_api_id}`.substring(0, 4) + '****' : null
    } : null,
    ai: setup.ai_api_key ? {
      connected: true,
      provider: setup.ai_provider || 'groq',
      keyPreview: setup.ai_api_key.substring(0, 8) + '...' + setup.ai_api_key.substring(setup.ai_api_key.length - 4)
    } : null
  };
};

module.exports = {
  getSetupStatus,
  saveTelegramCredentials,
  saveTelegramSession,
  saveAICredentials,
  getTelegramCredentials,
  getAICredentials,
  clearTelegramCredentials,
  clearAICredentials,
  getCredentialsStatus
};