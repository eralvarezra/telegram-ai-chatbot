const crypto = require('crypto');
const prisma = require('../config/database');
const logger = require('../utils/logger');

let currentBotInstanceId = null;

/**
 * Generate a unique bot instance ID from Telegram credentials
 * This creates a deterministic hash that changes when credentials change
 * @param {string} apiId - Telegram API ID
 * @param {string} apiHash - Telegram API Hash
 * @param {string} phone - Telegram phone number
 * @returns {string} - 16 character instance ID
 */
const generateInstanceId = (apiId, apiHash, phone) => {
  if (!apiId || !apiHash || !phone) {
    return null;
  }

  const combined = `${apiId}:${apiHash}:${phone}`;
  const hash = crypto.createHash('sha256').update(combined).digest('hex');
  return hash.substring(0, 16); // Use first 16 characters as instance ID
};

/**
 * Get or create bot instance ID from stored credentials
 * @returns {Promise<string|null>}
 */
const getBotInstanceId = async () => {
  if (currentBotInstanceId) {
    return currentBotInstanceId;
  }

  try {
    const setupService = require('./setup.service');
    const credentials = await setupService.getTelegramCredentials();

    if (!credentials || !credentials.apiId || !credentials.apiHash || !credentials.phone) {
      logger.warn('Telegram credentials not complete');
      return null;
    }

    currentBotInstanceId = generateInstanceId(
      credentials.apiId,
      credentials.apiHash,
      credentials.phone
    );

    logger.info(`Bot instance ID: ${currentBotInstanceId}`);
    return currentBotInstanceId;
  } catch (error) {
    logger.error('Error getting bot instance ID:', error);
    return null;
  }
};

/**
 * Check if bot has valid Telegram credentials configured
 * @returns {Promise<boolean>}
 */
const hasValidCredentials = async () => {
  try {
    const setupService = require('./setup.service');
    const credentials = await setupService.getTelegramCredentials();

    return !!(credentials && credentials.apiId && credentials.apiHash && credentials.phone && credentials.session);
  } catch (error) {
    logger.error('Error checking credentials:', error);
    return false;
  }
};

/**
 * Reset bot instance ID (call when credentials change)
 */
const resetBotInstanceId = () => {
  currentBotInstanceId = null;
  logger.info('Bot instance ID reset');
};

/**
 * Check if user belongs to current bot instance
 * If not, reset their conversation history
 * @param {number} userId - User ID
 * @param {string} telegramId - Telegram ID
 * @returns {Promise<{isNewInstance: boolean, user: object}>}
 */
const checkUserInstance = async (userId, telegramId = null) => {
  const instanceId = await getBotInstanceId();

  if (!instanceId) {
    // No instance ID (setup not complete), allow access
    return { isNewInstance: false, needsReset: false };
  }

  // Find user
  let user;
  if (userId) {
    user = await prisma.user.findUnique({ where: { id: userId } });
  } else if (telegramId) {
    user = await prisma.user.findUnique({ where: { telegram_id: BigInt(telegramId) } });
  }

  if (!user) {
    return { isNewInstance: false, needsReset: false };
  }

  // Check if user belongs to current instance
  if (user.bot_instance_id === instanceId) {
    return { isNewInstance: false, needsReset: false, user };
  }

  // User belongs to a different instance - reset needed
  logger.info(`User ${user.id} has different instance ID. Current: ${instanceId}, User: ${user.bot_instance_id || 'none'}`);

  return {
    isNewInstance: true,
    needsReset: true,
    user,
    previousInstanceId: user.bot_instance_id,
    currentInstanceId: instanceId
  };
};

/**
 * Reset user's conversation history for new bot instance
 * - Deletes all messages for this user
 * - Resets tone
 * - Updates bot_instance_id
 * @param {number} userId - User ID
 * @param {string} instanceId - New bot instance ID
 * @returns {Promise<object>}
 */
const resetUserForNewInstance = async (userId, instanceId) => {
  try {
    // Delete all messages for this user
    const deletedMessages = await prisma.message.deleteMany({
      where: { user_id: userId }
    });

    // Update user with new instance ID and reset tone
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        bot_instance_id: instanceId,
        last_tone: null
      }
    });

    logger.info(`Reset user ${userId} for new instance. Deleted ${deletedMessages.count} messages.`);

    return {
      success: true,
      deletedMessages: deletedMessages.count,
      user: updatedUser
    };
  } catch (error) {
    logger.error(`Error resetting user ${userId} for new instance:`, error);
    throw error;
  }
};

/**
 * Ensure user has correct bot instance ID
 * Call this when creating or updating a user
 * @param {number} userId - User ID
 * @returns {Promise<object>}
 */
const ensureUserInstance = async (userId) => {
  const instanceId = await getBotInstanceId();

  if (!instanceId) {
    return { needsReset: false };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    return { needsReset: false };
  }

  // If user has no instance ID or different instance ID
  if (user.bot_instance_id !== instanceId) {
    if (user.bot_instance_id) {
      // User had a previous instance - reset needed
      logger.info(`User ${userId} has outdated instance. Resetting...`);
      await resetUserForNewInstance(userId, instanceId);
      return { needsReset: true, wasReset: true };
    } else {
      // User has no instance ID yet - just update
      await prisma.user.update({
        where: { id: userId },
        data: { bot_instance_id: instanceId }
      });
      return { needsReset: false, wasUpdated: true };
    }
  }

  return { needsReset: false };
};

/**
 * Create or find user with instance isolation
 * @param {string} telegramId - Telegram ID
 * @param {string} username - Username
 * @param {string} displayName - Display name (firstName lastName)
 * @param {string} firstName - First name
 * @param {string} lastName - Last name
 * @returns {Promise<object>}
 */
const findOrCreateUserWithInstance = async (telegramId, username = null, displayName = null, firstName = null, lastName = null) => {
  const instanceId = await getBotInstanceId();

  // Find existing user
  let user = await prisma.user.findUnique({
    where: { telegram_id: BigInt(telegramId) }
  });

  if (user) {
    // Check instance
    if (user.bot_instance_id !== instanceId) {
      // Different instance - reset user
      if (user.bot_instance_id) {
        logger.info(`User ${telegramId} instance changed from ${user.bot_instance_id} to ${instanceId}. Resetting...`);
        await resetUserForNewInstance(user.id, instanceId);
        // Refetch user after reset
        user = await prisma.user.findUnique({ where: { id: user.id } });
      } else {
        // No previous instance - just update
        user = await prisma.user.update({
          where: { id: user.id },
          data: { bot_instance_id: instanceId }
        });
      }
    }

    // Update user info and last_seen
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        username: username || user.username,
        display_name: displayName || user.display_name,
        first_name: firstName || user.first_name,
        last_name: lastName || user.last_name,
        last_seen: new Date()
      }
    });

    return { user, isNew: false, wasReset: user.bot_instance_id !== instanceId };
  }

  // Create new user
  user = await prisma.user.create({
    data: {
      telegram_id: BigInt(telegramId),
      username,
      display_name: displayName,
      first_name: firstName,
      last_name: lastName,
      bot_instance_id: instanceId
    }
  });

  logger.info(`Created new user ${telegramId} with instance ${instanceId}`);

  return { user, isNew: true, wasReset: false };
};

module.exports = {
  generateInstanceId,
  getBotInstanceId,
  resetBotInstanceId,
  checkUserInstance,
  resetUserForNewInstance,
  ensureUserInstance,
  findOrCreateUserWithInstance,
  hasValidCredentials
};