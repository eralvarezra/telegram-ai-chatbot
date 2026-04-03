const prisma = require('../config/database');
const logger = require('../utils/logger');

/**
 * Clear all contacts for a specific owner
 * Called when a new API key is configured to remove old contacts
 */
const clearOwnerContacts = async (ownerId) => {
  try {
    const result = await prisma.user.deleteMany({
      where: { owner_user_id: ownerId }
    });

    logger.info(`Cleared ${result.count} contacts for owner ${ownerId}`);
    return { success: true, count: result.count };
  } catch (error) {
    logger.error(`Error clearing contacts for owner ${ownerId}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Sync conversations from Telegram to database
 * Called when bot starts to import all contacts/conversations
 * @param {boolean} clearPrevious - If true, clears previous contacts before syncing
 */
const syncConversations = async (client, ownerId, limit = 100, clearPrevious = false) => {
  try {
    logger.info(`Syncing conversations for owner ${ownerId}, limit: ${limit}, clearPrevious: ${clearPrevious}`);

    // Clear previous contacts if requested (new API key)
    if (clearPrevious) {
      const clearResult = await clearOwnerContacts(ownerId);
      if (!clearResult.success) {
        logger.warn(`Failed to clear previous contacts: ${clearResult.error}`);
      }
    }

    // Get dialogs from Telegram
    const dialogs = await client.getDialogs({ limit });

    let syncedCount = 0;
    let newUserCount = 0;

    for (const dialog of dialogs) {
      const entity = dialog.entity;

      // Skip channels and groups if configured (can be parameterized)
      const isUser = entity.className === 'User';
      const isChannel = entity.className === 'Channel';
      const isChat = entity.className === 'Chat';

      // Only sync users (private conversations) by default
      // Can be extended to sync channels and chats
      if (!isUser) {
        continue;
      }

      const telegramId = entity.id?.toString();
      if (!telegramId) continue;

      // Construct display name from available data
      const firstName = entity.firstName || null;
      const lastName = entity.lastName || null;
      const username = entity.username || null;
      const phone = entity.phone || null;

      // Priority: firstName + lastName > firstName > lastName > username > phone > User ID
      let displayName = null;
      if (firstName && lastName) {
        displayName = `${firstName} ${lastName}`;
      } else if (firstName) {
        displayName = firstName;
      } else if (lastName) {
        displayName = lastName;
      } else if (username) {
        displayName = `@${username}`;
      } else if (phone) {
        displayName = phone;
      } else {
        displayName = `User ${telegramId}`;
      }

      // Prepare user data
      const userData = {
        telegram_id: BigInt(telegramId),
        username: username,
        first_name: firstName,
        last_name: lastName,
        display_name: displayName,
        phone: phone,
        telegram_type: entity.className || 'User',
        access_hash: entity.accessHash?.toString() || null,
        owner_user_id: ownerId,
        last_seen: dialog.date ? new Date(dialog.date * 1000) : new Date()
      };

      try {
        // Upsert user (create or update)
        const existingUser = await prisma.user.findUnique({
          where: { telegram_id: BigInt(telegramId) }
        });

        if (existingUser) {
          // Update existing user - always update display_name with latest data
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              username: userData.username || existingUser.username,
              first_name: userData.first_name || existingUser.first_name,
              last_name: userData.last_name || existingUser.last_name,
              display_name: displayName, // Always update display_name
              phone: userData.phone || existingUser.phone,
              access_hash: userData.access_hash || existingUser.access_hash,
              owner_user_id: ownerId,
              last_seen: userData.last_seen
            }
          });
        } else {
          // Create new user
          await prisma.user.create({
            data: userData
          });
          newUserCount++;
        }

        syncedCount++;
      } catch (error) {
        logger.error(`Error syncing user ${telegramId}:`, error.message);
      }
    }

    logger.info(`Synced ${syncedCount} conversations, ${newUserCount} new users for owner ${ownerId}`);

    return {
      success: true,
      synced: syncedCount,
      newUsers: newUserCount,
      total: dialogs.length
    };
  } catch (error) {
    logger.error('Error syncing conversations:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get synced contacts for an owner
 */
const getSyncedContacts = async (ownerId, limit = 100, offset = 0) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        owner_user_id: ownerId,
        telegram_type: 'User'
      },
      orderBy: { last_seen: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        telegram_id: true,
        username: true,
        first_name: true,
        last_name: true,
        display_name: true,
        phone: true,
        last_seen: true,
        created_at: true
      }
    });

    // Convert BigInt to string for JSON serialization
    return users.map(user => ({
      ...user,
      telegram_id: user.telegram_id.toString()
    }));
  } catch (error) {
    logger.error('Error getting synced contacts:', error);
    throw error;
  }
};

/**
 * Get contact by Telegram ID
 */
const getContactByTelegramId = async (telegramId, ownerId = null) => {
  try {
    const where = { telegram_id: BigInt(telegramId) };
    if (ownerId) {
      where.owner_user_id = ownerId;
    }

    const user = await prisma.user.findFirst({
      where,
      select: {
        id: true,
        telegram_id: true,
        username: true,
        first_name: true,
        last_name: true,
        display_name: true,
        phone: true,
        telegram_type: true,
        access_hash: true,
        owner_user_id: true,
        last_seen: true
      }
    });

    if (!user) return null;

    return {
      ...user,
      telegram_id: user.telegram_id.toString()
    };
  } catch (error) {
    logger.error('Error getting contact by Telegram ID:', error);
    throw error;
  }
};

/**
 * Search contacts by name, username, or phone
 */
const searchContacts = async (query, ownerId, limit = 20) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        owner_user_id: ownerId,
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { first_name: { contains: query, mode: 'insensitive' } },
          { last_name: { contains: query, mode: 'insensitive' } },
          { display_name: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } }
        ]
      },
      take: limit,
      select: {
        id: true,
        telegram_id: true,
        username: true,
        first_name: true,
        last_name: true,
        display_name: true,
        phone: true,
        last_seen: true
      }
    });

    return users.map(user => ({
      ...user,
      telegram_id: user.telegram_id.toString()
    }));
  } catch (error) {
    logger.error('Error searching contacts:', error);
    throw error;
  }
};

module.exports = {
  clearOwnerContacts,
  syncConversations,
  getSyncedContacts,
  getContactByTelegramId,
  searchContacts
};