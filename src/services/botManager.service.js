const prisma = require('../config/database');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const userCredentialsService = require('./userCredentials.service');
const setupService = require('./setup.service');
const conversationSync = require('./conversationSync.service');
const logger = require('../utils/logger');

// Store active bot clients per user
const activeBots = new Map();

/**
 * Check if a bot is currently active (for message handler to verify)
 */
const isBotActive = (userId) => {
  return activeBots.has(userId.toString());
};

/**
 * Get the stored Telegram user ID for an owner
 */
const getStoredTelegramUserId = async (ownerId) => {
  try {
    const creds = await userCredentialsService.getUserCredentials(ownerId);
    return creds?.telegram_user_id || null;
  } catch (error) {
    return null;
  }
};

/**
 * Save the Telegram user ID for an owner
 */
const saveTelegramUserId = async (ownerId, telegramUserId) => {
  try {
    await prisma.userCredentials.update({
      where: { user_id: ownerId },
      data: { telegram_user_id: telegramUserId }
    });
  } catch (error) {
    logger.error(`Error saving Telegram user ID for owner ${ownerId}:`, error.message);
  }
};

/**
 * Start a Telegram bot for a specific user
 */
const startBotForUser = async (userId, handleMessageCallback) => {
  try {
    // Convert userId to string for consistent Map keys
    const userIdStr = userId.toString();

    // Check if bot is already running for this user
    if (activeBots.has(userIdStr)) {
      return { success: true, message: 'Bot ya está ejecutándose', status: 'running' };
    }

    // Try to get user-specific credentials first
    let creds = await userCredentialsService.getTelegramCredentials(userId);

    // Fall back to global credentials if user has no credentials
    if (!creds || !creds.apiId || !creds.apiHash) {
      logger.info(`No user credentials for ${userIdStr}, trying global credentials...`);
      const globalCreds = await setupService.getTelegramCredentials();
      if (globalCreds && globalCreds.apiId && globalCreds.apiHash && globalCreds.session) {
        creds = globalCreds;
        logger.info(`Using global credentials for bot ${userIdStr}`);
      }
    }

    if (!creds || !creds.apiId || !creds.apiHash || !creds.session) {
      return {
        success: false,
        message: 'Credenciales de Telegram no configuradas o sesión no iniciada',
        status: 'not_configured'
      };
    }

    logger.info(`Starting Telegram bot for user ${userIdStr}...`);

    const stringSession = new StringSession(creds.session);

    const client = new TelegramClient(
      stringSession,
      parseInt(creds.apiId),
      creds.apiHash,
      {
        connectionRetries: 5,
        useWSS: false,
        timeout: 10000 // 10 second timeout for operations
      }
    );

    // Start the client with saved session
    await client.connect();

    // Verify session is valid
    const me = await client.getMe();
    if (!me) {
      throw new Error('Invalid session');
    }

    const currentTelegramUserId = me.id?.toString();
    logger.info(`Bot connected for user ${userIdStr} as ${me.firstName || me.username || 'Unknown'}`);
    logger.info(`Bot details - ID: ${currentTelegramUserId}, Username: ${me.username || 'N/A'}, Phone: ${me.phone || 'N/A'}`);

    // Check if Telegram user ID has changed (new API key / account)
    const storedTelegramUserId = await getStoredTelegramUserId(userId);
    const isNewAccount = storedTelegramUserId && storedTelegramUserId !== currentTelegramUserId;

    if (isNewAccount) {
      logger.info(`Detected new Telegram account for owner ${userIdStr}. Previous: ${storedTelegramUserId}, New: ${currentTelegramUserId}`);
      logger.info(`Clearing previous contacts and syncing new ones...`);
    }

    // Save the current Telegram user ID
    await saveTelegramUserId(userId, currentTelegramUserId);

    // Sync conversations from Telegram (import contacts)
    // If new account detected, clear previous contacts
    logger.info(`Syncing conversations for user ${userIdStr}...`);
    const syncResult = await conversationSync.syncConversations(client, userId, 100, isNewAccount);
    if (syncResult.success) {
      const syncMessage = isNewAccount
        ? `Synced ${syncResult.synced} conversations (new account, cleared previous contacts)`
        : `Synced ${syncResult.synced} conversations (${syncResult.newUsers} new users)`;
      logger.info(syncMessage);
    } else {
      logger.warn(`Failed to sync conversations: ${syncResult.error}`);
    }

    // Create and store the event handler reference for later removal
    const newMessageEvent = new NewMessage({ incoming: true });
    const eventHandler = async (event) => {
      // CRITICAL: Check if bot is still active before processing message
      if (!isBotActive(userIdStr)) {
        logger.debug(`Ignoring message for stopped bot ${userIdStr}`);
        return;
      }
      await handleMessageCallback(event, userIdStr);
    };

    // Add message handler
    client.addEventHandler(eventHandler, newMessageEvent);
    logger.info(`Message handler registered for user ${userIdStr}`);

    // Store the client with string key, including handler reference
    activeBots.set(userIdStr, {
      client,
      handler: eventHandler,
      event: newMessageEvent,
      startedAt: new Date(),
      userInfo: {
        id: currentTelegramUserId,
        firstName: me.firstName,
        lastName: me.lastName,
        username: me.username
      }
    });

    // Update bot_active status
    await userCredentialsService.updateBotActive(userId, true);

    return {
      success: true,
      message: isNewAccount ? 'Bot iniciado con nueva cuenta. Contactos anteriores eliminados.' : 'Bot iniciado correctamente',
      status: 'running',
      isNewAccount,
      userInfo: {
        firstName: me.firstName,
        lastName: me.lastName,
        username: me.username
      }
    };
  } catch (error) {
    logger.error(`Error starting bot for user ${userId}:`, error);
    return {
      success: false,
      message: `Error: ${error.message}`,
      status: 'error'
    };
  }
};

/**
 * Stop a Telegram bot for a specific user
 */
const stopBotForUser = async (userId) => {
  try {
    // Convert userId to string for Map lookup
    const userIdStr = userId.toString();

    if (!activeBots.has(userIdStr)) {
      logger.info(`Bot not running for user ${userIdStr}, current active bots: ${Array.from(activeBots.keys()).join(', ')}`);
      return { success: true, message: 'Bot no está ejecutándose', status: 'stopped' };
    }

    const botInfo = activeBots.get(userIdStr);
    const { client, handler, event } = botInfo;

    logger.info(`Stopping bot for user ${userIdStr}...`);

    // CRITICAL: Remove from active bots FIRST - this prevents the handler from processing any more messages
    activeBots.delete(userIdStr);
    logger.info(`Removed bot ${userIdStr} from active bots`);

    // Remove event handler
    try {
      if (handler && event) {
        client.removeEventHandler(handler, event);
        logger.info(`Event handler removed for user ${userIdStr}`);
      }
    } catch (handlerError) {
      logger.warn(`Error removing event handler for user ${userIdStr}:`, handlerError.message);
    }

    // Disconnect the client with timeout
    try {
      const disconnectTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Disconnect timeout')), 3000);
      });

      await Promise.race([
        client.disconnect(),
        disconnectTimeout
      ]);
      logger.info(`Client disconnected for user ${userIdStr}`);
    } catch (disconnectError) {
      logger.warn(`Disconnect error for user ${userIdStr}:`, disconnectError.message);
      // Try to destroy the client completely
      try {
        if (client._destroy) {
          client._destroy();
        }
      } catch (e) {
        // Ignore
      }
    }

    // Update bot_active status
    await userCredentialsService.updateBotActive(userIdStr, false);

    logger.info(`Bot stopped successfully for user ${userIdStr}`);

    return { success: true, message: 'Bot detenido correctamente', status: 'stopped' };
  } catch (error) {
    logger.error(`Error stopping bot for user ${userId}:`, error);
    return { success: false, message: `Error: ${error.message}`, status: 'error' };
  }
};

/**
 * Get bot status for a user
 */
const getBotStatus = async (userId) => {
  try {
    const userIdStr = userId.toString();
    const botInfo = activeBots.get(userIdStr);

    if (botInfo) {
      return {
        status: 'running',
        startedAt: botInfo.startedAt,
        userInfo: botInfo.userInfo
      };
    }

    // Check if user has credentials configured
    const hasCredentials = await userCredentialsService.hasTelegramConfig(userId);
    const hasSession = await userCredentialsService.hasTelegramSession(userId);

    if (!hasCredentials) {
      return { status: 'not_configured' };
    }

    if (!hasSession) {
      return { status: 'needs_auth' };
    }

    return { status: 'stopped' };
  } catch (error) {
    logger.error(`Error getting bot status for user ${userId}:`, error);
    return { status: 'error', message: error.message };
  }
};

/**
 * Get all active bots
 */
const getActiveBots = () => {
  const bots = [];
  for (const [userId, botInfo] of activeBots) {
    bots.push({
      userId,
      startedAt: botInfo.startedAt,
      userInfo: botInfo.userInfo
    });
  }
  return bots;
};

/**
 * Check if a bot is running for a user
 */
const isBotRunning = (userId) => {
  return activeBots.has(userId.toString());
};

/**
 * Get the Telegram client for a user
 */
const getClientForUser = (userId) => {
  const botInfo = activeBots.get(userId.toString());
  return botInfo ? botInfo.client : null;
};

module.exports = {
  startBotForUser,
  stopBotForUser,
  getBotStatus,
  getActiveBots,
  isBotRunning,
  getClientForUser,
  isBotActive
};