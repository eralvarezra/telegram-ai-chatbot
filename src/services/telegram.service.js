const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const input = require('input');
const setupService = require('./setup.service');
const logger = require('../utils/logger');
const { ExternalServiceError } = require('../utils/errors');

let client = null;

const initializeClient = async () => {
  // Get credentials from database
  const creds = await setupService.getTelegramCredentials();

  if (!creds || !creds.apiId || !creds.apiHash) {
    throw new ExternalServiceError('Telegram credentials not configured. Complete setup first.', 'Telegram');
  }

  logger.info('Initializing Telegram client...');

  // Use saved session if available
  const stringSession = new StringSession(creds.session || '');

  client = new TelegramClient(
    stringSession,
    parseInt(creds.apiId),
    creds.apiHash,
    {
      connectionRetries: 5,
      useWSS: false
    }
  );

  await client.start({
    phoneNumber: async () => creds.phone || await input.text('Enter phone number: '),
    password: async () => await input.text('Enter 2FA password (if any): '),
    phoneCode: async () => await input.text('Enter verification code: '),
    onError: (err) => logger.error('Telegram auth error:', err)
  });

  // Save session if it's new
  const newSession = client.session.save();
  if (!creds.session) {
    logger.info('===================================');
    logger.info('NEW SESSION - Save this in the database:');
    logger.info(newSession);
    logger.info('===================================');

    // Auto-save to database
    await setupService.saveTelegramSession(newSession);
    logger.info('Session saved to database automatically');
  }

  logger.info('Telegram client connected!');

  return client;
};

const getClient = () => {
  if (!client) {
    throw new ExternalServiceError('Telegram client not initialized', 'Telegram');
  }
  return client;
};

const sendMessage = async (peerId, message) => {
  const tgClient = getClient();
  try {
    let entity;
    if (peerId.userId) {
      entity = await tgClient.getInputEntity(BigInt(peerId.userId));
    } else {
      entity = peerId;
    }

    await tgClient.sendMessage(entity, { message });
    logger.debug(`Message sent successfully`);
  } catch (error) {
    logger.error('Failed to send message:', error);
    throw new ExternalServiceError(error.message, 'Telegram');
  }
};

const addMessageHandler = (handler) => {
  const tgClient = getClient();
  tgClient.addEventHandler(handler, new NewMessage({ incoming: true }));
  logger.info('Message handler registered');
};

const extractMessageData = (event) => {
  const message = event.message;
  const senderId = event.senderId;

  return {
    messageId: message.id,
    chatId: event.chatId,
    peerId: message.peerId,
    senderId: senderId ? senderId.toString() : null,
    text: message.message || message.text,
    timestamp: new Date(message.date * 1000)
  };
};

/**
 * Check if client is connected
 */
const isClientConnected = () => {
  return client !== null && client.connected;
};

/**
 * Get all conversations/dialogs from Telegram history
 * Returns list of users/chats with their IDs and info
 */
const getConversations = async (limit = 100) => {
  const tgClient = getClient();

  // Verify client is connected
  if (!tgClient.connected) {
    throw new ExternalServiceError('Telegram client not connected', 'Telegram');
  }

  try {
    const dialogs = await tgClient.getDialogs({ limit });

    const conversations = [];

    for (const dialog of dialogs) {
      const entity = dialog.entity;

      // Skip channels and groups if needed (can be filtered later)
      const conversation = {
        id: entity.id?.toString() || dialog.id?.toString(),
        accessHash: entity.accessHash?.toString(),
        // User info
        userId: entity.id?.toString(),
        username: entity.username || null,
        firstName: entity.firstName || null,
        lastName: entity.lastName || null,
        phone: entity.phone || null,
        // Chat info
        title: entity.title || null,
        // Type
        type: entity.className, // 'User', 'Channel', 'Chat'
        // Timestamp of last message
        lastMessageDate: dialog.date ? new Date(dialog.date * 1000) : null,
        unreadCount: dialog.unreadCount || 0
      };

      conversations.push(conversation);
    }

    logger.info(`Retrieved ${conversations.length} conversations from Telegram`);
    return conversations;
  } catch (error) {
    logger.error('Failed to get conversations:', error);
    throw new ExternalServiceError(error.message, 'Telegram');
  }
};

/**
 * Get messages from a specific conversation
 */
const getConversationMessages = async (peerId, limit = 50) => {
  const tgClient = getClient();
  try {
    const entity = await tgClient.getInputEntity(BigInt(peerId));
    const messages = await tgClient.getMessages(entity, { limit });

    return messages.map(msg => ({
      id: msg.id?.toString(),
      text: msg.message || msg.text,
      date: new Date(msg.date * 1000),
      fromId: msg.fromId?.userId?.toString() || msg.peerId?.userId?.toString(),
      out: msg.out
    }));
  } catch (error) {
    logger.error('Failed to get messages:', error);
    throw new ExternalServiceError(error.message, 'Telegram');
  }
};

module.exports = {
  initializeClient,
  getClient,
  isClientConnected,
  sendMessage,
  addMessageHandler,
  extractMessageData,
  getConversations,
  getConversationMessages
};