const express = require('express');
const router = express.Router();
const aiConfigService = require('../services/aiConfig.service');
const prisma = require('../config/database');
const { ValidationError } = require('../utils/errors');
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

// Middleware to require authentication
const requireAuth = (req, res, next) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: 'No autorizado. Por favor inicia sesión.'
    });
  }
  req.userId = userId;
  next();
};

// POST /api/ai-config/generate
// Generate AI configuration from business description
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const { description, language } = req.body;
    const userId = req.userId;

    if (!description || description.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Description must be at least 10 characters'
      });
    }

    const result = await aiConfigService.generateConfigFromDescription(
      description.trim(),
      language,
      userId,
      userId  // Use userId as ownerId since it's the same user
    );

    res.json({
      success: true,
      generationId: result.generationId,
      config: result.config,
      detectedLanguage: result.detectedLanguage
    });
  } catch (error) {
    logger.error('Error generating AI config:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/ai-config/regenerate/:id
// Regenerate configuration with tweaks
router.post('/regenerate/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { tweakInstruction } = req.body;
    const userId = req.userId;

    if (!tweakInstruction || tweakInstruction.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Tweak instruction must be at least 3 characters'
      });
    }

    const result = await aiConfigService.regenerateConfig(
      parseInt(id),
      tweakInstruction.trim(),
      userId,
      userId
    );

    res.json({
      success: true,
      generationId: result.generationId,
      config: result.config
    });
  } catch (error) {
    logger.error('Error regenerating AI config:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/ai-config/apply/:id
// Apply generated configuration to BotConfig
router.post('/apply/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { editedConfig } = req.body;

    const result = await aiConfigService.applyGeneratedConfig(
      parseInt(id),
      editedConfig
    );

    res.json({
      success: true,
      config: result
    });
  } catch (error) {
    logger.error('Error applying AI config:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/ai-config/history
// Get AI config generation history
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const history = await aiConfigService.getGenerationHistory(limit);

    res.json({
      success: true,
      history
    });
  } catch (error) {
    logger.error('Error fetching AI config history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/ai-config/generation/:id
// Get a specific generation by ID
router.get('/generation/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const generation = await prisma.aIConfigGeneration.findUnique({
      where: { id: parseInt(id) }
    });

    if (!generation) {
      return res.status(404).json({
        success: false,
        error: 'Generation not found'
      });
    }

    res.json({
      success: true,
      generation
    });
  } catch (error) {
    logger.error('Error fetching generation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;