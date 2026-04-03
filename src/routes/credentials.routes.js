const express = require('express');
const router = express.Router();
const userCredentialsService = require('../services/userCredentials.service');
const logger = require('../utils/logger');

// Middleware to extract user ID from JWT token
const getUserId = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.id;
  } catch (error) {
    return null;
  }
};

// Get user's credentials status
router.get('/status', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const status = await userCredentialsService.getCredentialsStatus(userId);
    res.json(status);
  } catch (error) {
    logger.error('Get credentials status error:', error);
    res.status(500).json({ error: 'Error getting credentials status' });
  }
});

// Save Telegram credentials
router.post('/telegram', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { apiId, apiHash, phone } = req.body;

    if (!apiId || !apiHash || !phone) {
      return res.status(400).json({ error: 'API ID, API Hash, and phone are required' });
    }

    const credentials = await userCredentialsService.saveTelegramCredentials(userId, apiId, apiHash, phone);
    res.json({ success: true, message: 'Telegram credentials saved', credentials });
  } catch (error) {
    logger.error('Save Telegram credentials error:', error);
    res.status(500).json({ error: 'Error saving Telegram credentials' });
  }
});

// Save Telegram session
router.post('/telegram/session', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { session } = req.body;

    if (!session) {
      return res.status(400).json({ error: 'Session string is required' });
    }

    const credentials = await userCredentialsService.saveTelegramSession(userId, session);
    res.json({ success: true, message: 'Telegram session saved' });
  } catch (error) {
    logger.error('Save Telegram session error:', error);
    res.status(500).json({ error: 'Error saving Telegram session' });
  }
});

// Save AI credentials
router.post('/ai', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { apiKey, provider } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    const credentials = await userCredentialsService.saveAICredentials(userId, apiKey, provider || 'groq');
    res.json({ success: true, message: 'AI credentials saved' });
  } catch (error) {
    logger.error('Save AI credentials error:', error);
    res.status(500).json({ error: 'Error saving AI credentials' });
  }
});

// Clear Telegram credentials (unlink)
router.delete('/telegram', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await userCredentialsService.clearTelegramCredentials(userId);
    res.json({ success: true, message: 'Telegram credentials unlinked' });
  } catch (error) {
    logger.error('Clear Telegram credentials error:', error);
    res.status(500).json({ error: 'Error clearing Telegram credentials' });
  }
});

// Clear AI credentials (unlink)
router.delete('/ai', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await userCredentialsService.clearAICredentials(userId);
    res.json({ success: true, message: 'AI credentials unlinked' });
  } catch (error) {
    logger.error('Clear AI credentials error:', error);
    res.status(500).json({ error: 'Error clearing AI credentials' });
  }
});

// Check if user needs setup
router.get('/needs-setup', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const hasTelegram = await userCredentialsService.hasTelegramConfig(userId);
    const hasAI = await userCredentialsService.hasAIConfig(userId);

    res.json({
      needsSetup: !hasTelegram || !hasAI,
      needsTelegram: !hasTelegram,
      needsAI: !hasAI
    });
  } catch (error) {
    logger.error('Check needs setup error:', error);
    res.status(500).json({ error: 'Error checking setup status' });
  }
});

// Complete setup for user
router.post('/complete', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const authService = require('./auth.service');
    await authService.completeOnboarding(userId);

    res.json({ success: true, message: 'Setup completed' });
  } catch (error) {
    logger.error('Complete setup error:', error);
    res.status(500).json({ error: 'Error completing setup' });
  }
});

module.exports = router;