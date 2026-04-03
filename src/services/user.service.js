const prisma = require('../config/database');
const logger = require('../utils/logger');
const botInstanceService = require('./botInstance.service');

const findOrCreateUser = async (telegramId, username = null, displayName = null, firstName = null, lastName = null) => {
  const user = await prisma.user.upsert({
    where: { telegram_id: BigInt(telegramId) },
    update: {
      username: username || undefined,
      display_name: displayName || undefined,
      first_name: firstName || undefined,
      last_name: lastName || undefined,
      last_seen: new Date()
    },
    create: {
      telegram_id: BigInt(telegramId),
      username,
      display_name: displayName,
      first_name: firstName,
      last_name: lastName
    }
  });

  logger.debug(`User processed: telegram_id=${telegramId}`);
  return user;
};

// Instance-aware user creation - handles conversation reset when bot instance changes
const findOrCreateUserWithInstance = async (telegramId, username = null, displayName = null, firstName = null, lastName = null) => {
  return botInstanceService.findOrCreateUserWithInstance(telegramId, username, displayName, firstName, lastName);
};

const getUserByTelegramId = async (telegramId) => {
  return prisma.user.findUnique({
    where: { telegram_id: BigInt(telegramId) }
  });
};

const getUserById = async (id) => {
  return prisma.user.findUnique({
    where: { id }
  });
};

const updateUserTone = async (userId, tone) => {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { last_tone: tone }
    });
    logger.debug(`Updated user ${userId} tone to: ${tone}`);
  } catch (error) {
    logger.error(`Failed to update user tone: ${error.message}`);
  }
};

module.exports = {
  findOrCreateUser,
  findOrCreateUserWithInstance,
  getUserByTelegramId,
  getUserById,
  updateUserTone
};