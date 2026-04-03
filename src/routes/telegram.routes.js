const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const userCredentialsService = require('../services/userCredentials.service');
const setupService = require('../services/setup.service');
const telegramService = require('../services/telegram.service');
const botManager = require('../services/botManager.service');
const conversationSync = require('../services/conversationSync.service');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to extract user ID from JWT token
const getUserId = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];

  try {
    // Try JWT verification first
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.id;
  } catch (error) {
    // Try legacy token verification
    try {
      const decodedLegacy = Buffer.from(token, 'base64').toString('utf-8');
      if (decodedLegacy.startsWith('authenticated_')) {
        // Legacy auth - get the first admin user
        const adminUser = await prisma.adminUser.findFirst();
        return adminUser?.id || null;
      }
    } catch (e) {
      return null;
    }
    return null;
  }
};

// Store pending authentication state per user
const pendingAuths = new Map();

/**
 * Start Telegram connection process
 */
router.post('/connect', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Initialize pending auth state for this user
    pendingAuths.set(userId, {
      status: 'connecting',
      phoneNumber: null,
      error: null,
      client: null,
      phoneCodeHash: null
    });

    const pendingAuth = pendingAuths.get(userId);

    // Try user credentials first, fall back to global credentials
    let creds = await userCredentialsService.getTelegramCredentials(userId);

    // If user doesn't have credentials, try global setup (for backward compatibility)
    if (!creds || !creds.apiId || !creds.apiHash) {
      creds = await setupService.getTelegramCredentials();
    }

    if (!creds || !creds.apiId || !creds.apiHash || !creds.phone) {
      pendingAuth.status = 'error';
      pendingAuth.error = 'Credenciales de Telegram no configuradas';
      return res.status(400).json({
        error: 'Credenciales de Telegram no configuradas. Ve a Configuración para agregarlas.',
        status: 'error'
      });
    }

    pendingAuth.phoneNumber = creds.phone;

    // Check if we already have a session
    if (creds.session) {
      pendingAuth.status = 'connected';
      return res.json({
        status: 'connected',
        message: 'Sesión ya activa',
        phoneNumber: creds.phone
      });
    }

    // Need to authenticate - create client and send code
    const { TelegramClient } = require('telegram');
    const { StringSession } = require('telegram/sessions');
    const { Api } = require('telegram');

    const stringSession = new StringSession('');

    const client = new TelegramClient(
      stringSession,
      parseInt(creds.apiId),
      creds.apiHash,
      { connectionRetries: 5, useWSS: false }
    );

    // Connect to Telegram
    await client.connect();

    // Send verification code using the API directly
    const result = await client.invoke(
      new Api.auth.SendCode({
        phoneNumber: creds.phone,
        apiId: parseInt(creds.apiId),
        apiHash: creds.apiHash,
        settings: new Api.CodeSettings({
          allowFlashcall: false,
          currentNumber: false,
          allowAppHash: true,
        }),
      })
    );

    // Store client and phoneCodeHash for later use
    pendingAuth.client = client;
    pendingAuth.phoneCodeHash = result.phoneCodeHash;
    pendingAuth.status = 'waiting_code';

    logger.info(`Verification code sent to ${creds.phone} for user ${userId}`);

    res.json({
      status: 'waiting_code',
      message: 'Código de verificación enviado a tu Telegram',
      phoneNumber: creds.phone
    });

  } catch (error) {
    logger.error('Error starting Telegram connection:', error);
    const userId = await getUserId(req);
    if (userId && pendingAuths.has(userId)) {
      const pendingAuth = pendingAuths.get(userId);
      pendingAuth.status = 'error';
      pendingAuth.error = error.message;

      // Clean up client on error
      if (pendingAuth.client) {
        try {
          await pendingAuth.client.disconnect();
        } catch (e) {}
        pendingAuth.client = null;
      }
    }

    res.status(500).json({
      error: error.message,
      status: 'error'
    });
  }
});

/**
 * Submit verification code
 */
router.post('/verify-code', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Código requerido' });
    }

    if (!pendingAuths.has(userId)) {
      return res.status(400).json({
        error: 'No hay verificación pendiente',
        status: 'idle'
      });
    }

    const pendingAuth = pendingAuths.get(userId);

    if (pendingAuth.status !== 'waiting_code') {
      return res.status(400).json({
        error: 'No hay verificación pendiente',
        status: pendingAuth.status
      });
    }

    // Try user credentials first, fall back to global credentials
    let creds = await userCredentialsService.getTelegramCredentials(userId);
    if (!creds || !creds.apiId) {
      creds = await setupService.getTelegramCredentials();
    }

    const { Api } = require('telegram');

    try {
      // Try to sign in with the code
      await pendingAuth.client.invoke(
        new Api.auth.SignIn({
          phoneNumber: creds.phone,
          phoneCodeHash: pendingAuth.phoneCodeHash,
          phoneCode: code,
        })
      );

      // Success - save session
      const session = pendingAuth.client.session.save();

      // Save to user credentials
      await userCredentialsService.saveTelegramSession(userId, session);

      pendingAuth.status = 'connected';
      const savedClient = pendingAuth.client;
      pendingAuth.client = null;

      logger.info(`Telegram authenticated successfully for user ${userId}`);

      res.json({
        status: 'connected',
        message: '¡Conexión exitosa!'
      });

    } catch (error) {
      // Check if 2FA is required
      if (error.message && (error.message.includes('SESSION_PASSWORD_NEEDED') || error.message.includes('2FA') || error.message.includes('password'))) {
        // Need 2FA password
        pendingAuth.status = 'waiting_password';

        res.json({
          status: 'waiting_password',
          message: 'Se requiere contraseña de verificación en dos pasos'
        });
      } else {
        throw error;
      }
    }

  } catch (error) {
    logger.error('Error verifying code:', error);
    const userId = await getUserId(req);
    if (userId && pendingAuths.has(userId)) {
      const pendingAuth = pendingAuths.get(userId);
      pendingAuth.status = 'error';
      pendingAuth.error = error.message;
    }

    res.status(400).json({
      error: error.message,
      status: 'error'
    });
  }
});

/**
 * Submit 2FA password
 */
router.post('/verify-password', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Contraseña requerida' });
    }

    if (!pendingAuths.has(userId)) {
      return res.status(400).json({
        error: 'No se requiere contraseña en este momento',
        status: 'idle'
      });
    }

    const pendingAuth = pendingAuths.get(userId);

    if (pendingAuth.status !== 'waiting_password') {
      return res.status(400).json({
        error: 'No se requiere contraseña en este momento',
        status: pendingAuth.status
      });
    }

    const { Api } = require('telegram');

    // Get password info first
    const passwordInfo = await pendingAuth.client.invoke(new Api.account.GetPassword());

    // Compute password hash
    const { computeCheck } = require('telegram/Password');
    const passwordCheck = await computeCheck(passwordInfo, password);

    // Sign in with password
    await pendingAuth.client.invoke(
      new Api.auth.CheckPassword({
        password: passwordCheck,
      })
    );

    // Success - save session
    const session = pendingAuth.client.session.save();

    // Save to user credentials
    await userCredentialsService.saveTelegramSession(userId, session);

    pendingAuth.status = 'connected';
    pendingAuth.client = null;

    logger.info(`Telegram authenticated with 2FA successfully for user ${userId}`);

    res.json({
      status: 'connected',
      message: '¡Conexión exitosa!'
    });

  } catch (error) {
    logger.error('Error verifying password:', error);
    const userId = await getUserId(req);
    if (userId && pendingAuths.has(userId)) {
      const pendingAuth = pendingAuths.get(userId);
      pendingAuth.status = 'error';
      pendingAuth.error = error.message;
    }

    res.status(400).json({
      error: 'Contraseña incorrecta',
      status: 'error'
    });
  }
});

/**
 * Get current authentication status
 */
router.get('/status', async (req, res) => {
  const userId = await getUserId(req);
  if (!userId || !pendingAuths.has(userId)) {
    return res.json({
      status: 'idle',
      phoneNumber: null,
      error: null
    });
  }

  const pendingAuth = pendingAuths.get(userId);
  res.json({
    status: pendingAuth.status,
    phoneNumber: pendingAuth.phoneNumber,
    error: pendingAuth.error
  });
});

/**
 * Cancel pending authentication
 */
router.post('/cancel', async (req, res) => {
  const userId = await getUserId(req);

  if (userId && pendingAuths.has(userId)) {
    const pendingAuth = pendingAuths.get(userId);
    if (pendingAuth.client) {
      try {
        await pendingAuth.client.disconnect();
      } catch (e) {}
    }
    pendingAuths.delete(userId);
  }

  res.json({ status: 'cancelled' });
});

/**
 * Get Telegram connection status for user
 */
router.get('/connection-status', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const status = await userCredentialsService.getCredentialsStatus(userId);
    res.json(status);
  } catch (error) {
    logger.error('Error getting connection status:', error);
    res.status(500).json({ error: 'Error al obtener estado de conexión' });
  }
});

/**
 * Get Telegram account info
 */
router.get('/account-info', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Get stored Telegram user ID
    const creds = await userCredentialsService.getUserCredentials(userId);
    const telegramUserId = creds?.telegram_user_id || null;

    // Get contact count
    const contactCount = await prisma.user.count({
      where: { owner_user_id: userId }
    });

    res.json({
      success: true,
      telegramUserId,
      contactCount,
      credentials: {
        hasApiId: !!creds?.telegram_api_id,
        hasApiHash: !!creds?.telegram_api_hash,
        phone: creds?.telegram_phone || null
      }
    });
  } catch (error) {
    logger.error('Error getting account info:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Clear all contacts for the current user
 */
router.delete('/contacts', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const result = await conversationSync.clearOwnerContacts(userId);

    if (result.success) {
      res.json({
        success: true,
        message: `${result.count} contactos eliminados`,
        count: result.count
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Error clearing contacts:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all conversations from Telegram history
 * Returns list of users/chats with their IDs
 */
router.get('/conversations', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Get the Telegram client from botManager (per-user client)
    const client = botManager.getClientForUser(userId);

    // Check if Telegram client is connected
    if (!client || !client.connected) {
      return res.status(400).json({ error: 'Telegram no está conectado. Inicia el bot primero con /api/bot/start' });
    }

    // Get conversations using the user's client
    const limit = parseInt(req.query.limit) || 100;
    const dialogs = await client.getDialogs({ limit });

    const conversations = [];
    for (const dialog of dialogs) {
      const entity = dialog.entity;

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

    res.json({
      success: true,
      count: conversations.length,
      conversations
    });
  } catch (error) {
    logger.error('Error getting conversations:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get messages from a specific conversation
 */
router.get('/conversations/:peerId/messages', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { peerId } = req.params;
    if (!peerId) {
      return res.status(400).json({ error: 'ID de conversación requerido' });
    }

    // Get the Telegram client from botManager
    const client = botManager.getClientForUser(userId);

    // Check if Telegram client is connected
    if (!client || !client.connected) {
      return res.status(400).json({ error: 'Telegram no está conectado. Inicia el bot primero con /api/bot/start' });
    }

    // Get messages
    const limit = parseInt(req.query.limit) || 50;
    const entity = await client.getInputEntity(BigInt(peerId));
    const messages = await client.getMessages(entity, { limit });

    const formattedMessages = messages.map(msg => ({
      id: msg.id?.toString(),
      text: msg.message || msg.text,
      date: new Date(msg.date * 1000),
      fromId: msg.fromId?.userId?.toString() || msg.peerId?.userId?.toString(),
      out: msg.out
    }));

    res.json({
      success: true,
      count: formattedMessages.length,
      messages: formattedMessages
    });
  } catch (error) {
    logger.error('Error getting messages:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get synced contacts from database
 * Returns list of users that have been synced from Telegram
 */
router.get('/contacts', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const contacts = await conversationSync.getSyncedContacts(userId, limit, offset);

    res.json({
      success: true,
      count: contacts.length,
      contacts
    });
  } catch (error) {
    logger.error('Error getting contacts:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Search contacts by name, username, or phone
 */
router.get('/contacts/search', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'La búsqueda debe tener al menos 2 caracteres' });
    }

    const limit = parseInt(req.query.limit) || 20;
    const contacts = await conversationSync.searchContacts(q, userId, limit);

    res.json({
      success: true,
      count: contacts.length,
      contacts
    });
  } catch (error) {
    logger.error('Error searching contacts:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Manually sync conversations from Telegram
 */
router.post('/sync', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Get the Telegram client from botManager
    const client = botManager.getClientForUser(userId);

    // Check if Telegram client is connected
    if (!client || !client.connected) {
      return res.status(400).json({ error: 'Telegram no está conectado. Inicia el bot primero con /api/bot/start' });
    }

    const limit = parseInt(req.query.limit) || 100;
    const result = await conversationSync.syncConversations(client, userId, limit);

    if (result.success) {
      res.json({
        success: true,
        message: `Sincronizados ${result.synced} contactos, ${result.newUsers} nuevos`,
        ...result
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Error syncing conversations:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;