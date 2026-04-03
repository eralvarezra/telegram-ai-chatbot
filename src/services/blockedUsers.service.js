const prisma = require('../config/database');
const logger = require('../utils/logger');

// In-memory cache for blocked users
// Structure: Map<owner_user_id, Set<telegram_id>>
const blockedUsersCache = new Map();

// Cache refresh interval (5 minutes)
const CACHE_REFRESH_INTERVAL = 5 * 60 * 1000;

/**
 * Get the bot owner's user ID
 * For legacy bots (no ownerId passed), find the first admin user
 * @param {number|null} ownerUserId
 * @returns {Promise<number|null>}
 */
const getOwnerUserId = async (ownerUserId) => {
  if (ownerUserId) {
    const id = typeof ownerUserId === 'string' ? parseInt(ownerUserId, 10) : ownerUserId;
    return isNaN(id) ? null : id;
  }

  // Legacy mode - find the first admin user (bot owner)
  try {
    const adminUser = await prisma.adminUser.findFirst({
      select: { id: true }
    });
    return adminUser?.id || null;
  } catch (error) {
    logger.error('Error finding admin user:', error);
    return null;
  }
};

/**
 * Initialize cache for a specific owner
 * @param {number} ownerUserId
 */
const initCache = async (ownerUserId) => {
  try {
    const blockedUsers = await prisma.blockedUser.findMany({
      where: { owner_user_id: ownerUserId },
      select: { telegram_id: true }
    });

    const telegramIds = new Set(
      blockedUsers.map(u => u.telegram_id.toString())
    );

    blockedUsersCache.set(ownerUserId, telegramIds);
    logger.debug(`Initialized blocked users cache for owner ${ownerUserId}: ${telegramIds.size} users`);
    return telegramIds;
  } catch (error) {
    logger.error(`Error initializing cache for owner ${ownerUserId}:`, error);
    return new Set();
  }
};

/**
 * Check if a user is blocked (with cache)
 * @param {number|null} ownerUserId - The bot owner's user ID (null for legacy bot)
 * @param {string} telegramId - The Telegram user ID to check
 * @returns {Promise<boolean>}
 */
const isBlocked = async (ownerUserId, telegramId) => {
  try {
    // Get the actual owner ID (handles legacy bot case)
    const ownerId = await getOwnerUserId(ownerUserId);

    if (!ownerId) {
      // No owner found, can't check blocked status
      logger.warn('No owner ID found, skipping blocked check');
      return false;
    }

    // Check cache first
    let cachedSet = blockedUsersCache.get(ownerId);

    if (!cachedSet) {
      // Initialize cache if not exists
      logger.debug(`No cache found for owner ${ownerId}, initializing...`);
      cachedSet = await initCache(ownerId);
    }

    const telegramIdStr = telegramId.toString();
    const blocked = cachedSet.has(telegramIdStr);

    logger.debug(`Blocked check: ownerId=${ownerId}, telegramId=${telegramIdStr}, blocked=${blocked}, cacheSize=${cachedSet.size}`);

    if (blocked) {
      logger.info(`User ${telegramId} is blocked for owner ${ownerId}`);
    }

    return blocked;
  } catch (error) {
    logger.error('Error checking blocked status:', error);
    return false; // Default to not blocked on error
  }
};

/**
 * Block a user
 * @param {number|null} ownerUserId - The bot owner's user ID (null for legacy bot)
 * @param {string} telegramId - The Telegram user ID to block
 * @param {string} username - Optional Telegram username
 * @param {string} displayName - Optional display name
 * @param {string} reason - Optional reason for blocking
 * @returns {Promise<Object>}
 */
const blockUser = async (ownerUserId, telegramId, username = null, displayName = null, reason = null) => {
  try {
    // Get the actual owner ID (handles legacy bot case)
    const ownerId = await getOwnerUserId(ownerUserId);

    if (!ownerId) {
      throw new Error('No bot owner found');
    }

    // Convert telegramId to BigInt for storage
    const telegramIdBigInt = BigInt(telegramId);

    const blockedUser = await prisma.blockedUser.upsert({
      where: {
        owner_user_id_telegram_id: {
          owner_user_id: ownerId,
          telegram_id: telegramIdBigInt
        }
      },
      update: {
        username: username || undefined,
        display_name: displayName || undefined,
        reason: reason || undefined
      },
      create: {
        owner_user_id: ownerId,
        telegram_id: telegramIdBigInt,
        username,
        display_name: displayName,
        reason
      }
    });

    // Update cache
    let cachedSet = blockedUsersCache.get(ownerId);
    if (!cachedSet) {
      cachedSet = new Set();
      blockedUsersCache.set(ownerId, cachedSet);
    }
    cachedSet.add(telegramId.toString());

    logger.info(`Blocked user ${telegramId} for owner ${ownerId}`);
    return serializeBlockedUser(blockedUser);
  } catch (error) {
    logger.error('Error blocking user:', error);
    throw error;
  }
};

/**
 * Unblock a user
 * @param {number|null} ownerUserId - The bot owner's user ID (null for legacy bot)
 * @param {string} telegramId - The Telegram user ID to unblock
 * @returns {Promise<boolean>}
 */
const unblockUser = async (ownerUserId, telegramId) => {
  try {
    // Get the actual owner ID (handles legacy bot case)
    const ownerId = await getOwnerUserId(ownerUserId);

    if (!ownerId) {
      throw new Error('No bot owner found');
    }

    const telegramIdBigInt = BigInt(telegramId);

    const result = await prisma.blockedUser.deleteMany({
      where: {
        owner_user_id: ownerId,
        telegram_id: telegramIdBigInt
      }
    });

    if (result.count > 0) {
      // Update cache
      const cachedSet = blockedUsersCache.get(ownerId);
      if (cachedSet) {
        cachedSet.delete(telegramId.toString());
      }
      logger.info(`Unblocked user ${telegramId} for owner ${ownerId}`);
      return true;
    }

    return false;
  } catch (error) {
    logger.error('Error unblocking user:', error);
    throw error;
  }
};

/**
 * Unblock a user by block record ID
 * @param {number|null} ownerUserId - The bot owner's user ID (null for legacy bot)
 * @param {number} blockId - The blocked user record ID
 * @returns {Promise<boolean>}
 */
const unblockUserById = async (ownerUserId, blockId) => {
  try {
    // Get the actual owner ID (handles legacy bot case)
    const ownerId = await getOwnerUserId(ownerUserId);

    if (!ownerId) {
      throw new Error('No bot owner found');
    }

    // First get the record to find the telegram_id
    const blockedUser = await prisma.blockedUser.findFirst({
      where: {
        id: blockId,
        owner_user_id: ownerId
      }
    });

    if (!blockedUser) {
      return false;
    }

    await prisma.blockedUser.delete({
      where: { id: blockId }
    });

    // Update cache
    const cachedSet = blockedUsersCache.get(ownerId);
    if (cachedSet) {
      cachedSet.delete(blockedUser.telegram_id.toString());
    }

    logger.info(`Unblocked user ${blockedUser.telegram_id} for owner ${ownerId}`);
    return true;
  } catch (error) {
    logger.error('Error unblocking user by ID:', error);
    throw error;
  }
};

/**
 * Get all blocked users for an owner
 * @param {number|null} ownerUserId - The bot owner's user ID (null for legacy bot)
 * @returns {Promise<Array>}
 */
const getBlockedUsers = async (ownerUserId) => {
  try {
    // Get the actual owner ID (handles legacy bot case)
    const ownerId = await getOwnerUserId(ownerUserId);

    if (!ownerId) {
      return []; // No owner found, return empty list
    }

    const blockedUsers = await prisma.blockedUser.findMany({
      where: { owner_user_id: ownerId },
      orderBy: { created_at: 'desc' }
    });

    return blockedUsers.map(serializeBlockedUser);
  } catch (error) {
    logger.error('Error getting blocked users:', error);
    throw error;
  }
};

/**
 * Get a single blocked user by telegram ID
 * @param {number|null} ownerUserId - The bot owner's user ID (null for legacy bot)
 * @param {string} telegramId - The Telegram user ID
 * @returns {Promise<Object|null>}
 */
const getBlockedUser = async (ownerUserId, telegramId) => {
  try {
    // Get the actual owner ID (handles legacy bot case)
    const ownerId = await getOwnerUserId(ownerUserId);

    if (!ownerId) {
      return null; // No owner found
    }

    const telegramIdBigInt = BigInt(telegramId);

    const blockedUser = await prisma.blockedUser.findUnique({
      where: {
        owner_user_id_telegram_id: {
          owner_user_id: ownerId,
          telegram_id: telegramIdBigInt
        }
      }
    });

    return blockedUser ? serializeBlockedUser(blockedUser) : null;
  } catch (error) {
    logger.error('Error getting blocked user:', error);
    throw error;
  }
};

/**
 * Refresh cache for an owner
 * @param {number|null} ownerUserId
 */
const refreshCache = async (ownerUserId) => {
  const ownerId = await getOwnerUserId(ownerUserId);

  if (!ownerId) {
    return;
  }

  blockedUsersCache.delete(ownerId);
  await initCache(ownerId);
};

/**
 * Clear all cache (useful for testing or forced refresh)
 */
const clearCache = () => {
  blockedUsersCache.clear();
  logger.debug('Cleared all blocked users cache');
};

/**
 * Serialize blocked user for API response
 */
const serializeBlockedUser = (blockedUser) => ({
  id: blockedUser.id,
  owner_user_id: blockedUser.owner_user_id,
  telegram_id: blockedUser.telegram_id.toString(),
  username: blockedUser.username,
  display_name: blockedUser.display_name,
  reason: blockedUser.reason,
  created_at: blockedUser.created_at.toISOString()
});

module.exports = {
  getOwnerUserId,
  isBlocked,
  blockUser,
  unblockUser,
  unblockUserById,
  getBlockedUsers,
  getBlockedUser,
  refreshCache,
  clearCache,
  initCache
};