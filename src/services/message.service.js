const prisma = require('../config/database');
const config = require('../config');
const logger = require('../utils/logger');
const botInstanceService = require('./botInstance.service');

const saveMessage = async (userId, role, content) => {
  // Get current bot instance ID
  const instanceId = await botInstanceService.getBotInstanceId();

  const message = await prisma.message.create({
    data: {
      user_id: userId,
      role,
      content,
      bot_instance_id: instanceId
    }
  });

  logger.debug(`Message saved: user_id=${userId}, role=${role}, instance=${instanceId || 'none'}`);
  return message;
};

const getLastMessages = async (userId, limit = 20) => {
  // Get current bot instance ID
  const instanceId = await botInstanceService.getBotInstanceId();

  const messages = await prisma.message.findMany({
    where: {
      user_id: userId,
      bot_instance_id: instanceId // Only get messages for current instance
    },
    orderBy: { timestamp: 'desc' },
    take: limit,
    select: {
      id: true,
      role: true,
      content: true,
      timestamp: true
    }
  });

  return messages.reverse();
};

const getConversationHistory = async (userId, limit = 20) => {
  const messages = await getLastMessages(userId, limit);

  // Format for AI context
  return messages.map(m => ({
    role: m.role,
    content: m.content,
    timestamp: m.timestamp
  }));
};

// Get a summary of the user's conversation topics
const getConversationSummary = async (userId) => {
  // Get current bot instance ID
  const instanceId = await botInstanceService.getBotInstanceId();

  const messages = await prisma.message.findMany({
    where: {
      user_id: userId,
      bot_instance_id: instanceId // Only get messages for current instance
    },
    orderBy: { timestamp: 'desc' },
    take: 50,
    select: {
      role: true,
      content: true
    }
  });

  if (messages.length === 0) return null;

  // Return key topics discussed (last 50 messages)
  return messages.reverse();
};

// Delete all messages for a user (for instance reset)
const deleteUserMessages = async (userId) => {
  const result = await prisma.message.deleteMany({
    where: { user_id: userId }
  });

  logger.info(`Deleted ${result.count} messages for user ${userId}`);
  return result;
};

module.exports = {
  saveMessage,
  getLastMessages,
  getConversationHistory,
  getConversationSummary,
  deleteUserMessages
};