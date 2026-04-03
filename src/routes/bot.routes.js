const express = require('express');
const router = express.Router();
const botManager = require('../services/botManager.service');
const { handleMessage } = require('../messageHandler');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to extract user ID from JWT token
const getUserId = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.id;
  } catch (error) {
    return null;
  }
};

/**
 * Start the bot for the authenticated user
 */
router.post('/start', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Create a message handler wrapper with userId
    const messageHandler = async (event, ownerId) => {
      await handleMessage(event, ownerId);
    };

    const result = await botManager.startBotForUser(userId, messageHandler);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        status: result.status,
        userInfo: result.userInfo
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message,
        status: result.status
      });
    }
  } catch (error) {
    logger.error('Start bot error:', error);
    res.status(500).json({ error: 'Error al iniciar el bot' });
  }
});

/**
 * Stop the bot for the authenticated user
 */
router.post('/stop', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const result = await botManager.stopBotForUser(userId);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        status: result.status
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message,
        status: result.status
      });
    }
  } catch (error) {
    logger.error('Stop bot error:', error);
    res.status(500).json({ error: 'Error al detener el bot' });
  }
});

/**
 * Get bot status for the authenticated user
 */
router.get('/status', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const status = await botManager.getBotStatus(userId);
    res.json(status);
  } catch (error) {
    logger.error('Get bot status error:', error);
    res.status(500).json({ error: 'Error al obtener estado del bot' });
  }
});

/**
 * Get all active bots (admin only)
 */
router.get('/active', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // TODO: Add admin check here if needed
    const bots = botManager.getActiveBots();
    res.json({ bots });
  } catch (error) {
    logger.error('Get active bots error:', error);
    res.status(500).json({ error: 'Error al obtener bots activos' });
  }
});

module.exports = router;