const express = require('express');
const router = express.Router();
const agentService = require('../services/agent.service');
const agentMemoryService = require('../services/agentMemory.service');
const authMiddleware = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/agent
 * Get user's agent configuration
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await require('../config/database').adminUser.findUnique({
      where: { id: userId },
      select: { plan: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Free users get default config
    if (user.plan !== 'premium') {
      return res.json({
        success: true,
        agent: null,
        isDefault: true,
        defaultConfig: agentService.getDefaultConfig(),
        availableTones: agentService.getAvailableTones(),
      plan: 'free',
        message: 'Upgrade to premium to customize your AI agent'
      });
    }

    // Premium users get their agent
    let agent = await agentService.getAgent(userId);

    if (!agent) {
      // Auto-create agent for premium users
      agent = await agentService.createAgent(userId);
    }

    res.json({
      success: true,
      agent,
      isDefault: false,
      availableTones: agentService.getAvailableTones(),
      plan: 'premium'
    });
  } catch (error) {
    logger.error('Error getting agent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get agent configuration'
    });
  }
});

/**
 * POST /api/agent
 * Create or update agent (premium only)
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await require('../config/database').adminUser.findUnique({
      where: { id: userId },
      select: { plan: true }
    });

    if (!user || user.plan !== 'premium') {
      return res.status(403).json({
        success: false,
        error: 'Premium subscription required',
        message: 'Upgrade to premium to create a custom AI agent'
      });
    }

    const config = req.body;

    // Validate tone
    const validTones = ['serious', 'friendly', 'sexy', 'explicit', 'playful', 'professional'];
    if (config.tone && !validTones.includes(config.tone)) {
      return res.status(400).json({
        success: false,
        error: `Invalid tone. Must be one of: ${validTones.join(', ')}`
      });
    }

    // Validate response style
    const validStyles = ['short', 'medium', 'long', 'casual'];
    if (config.response_style && !validStyles.includes(config.response_style)) {
      return res.status(400).json({
        success: false,
        error: `Invalid response style. Must be one of: ${validStyles.join(', ')}`
      });
    }

    // Validate engagement level
    if (config.engagement_level !== undefined) {
      const level = parseInt(config.engagement_level);
      if (isNaN(level) || level < 1 || level > 5) {
        return res.status(400).json({
          success: false,
          error: 'Engagement level must be between 1 and 5'
        });
      }
    }

    // Check if agent exists
    const existing = await agentService.getAgent(userId);

    let agent;
    if (existing) {
      agent = await agentService.updateAgent(userId, config);
    } else {
      agent = await agentService.createAgent(userId, config);
    }

    res.json({
      success: true,
      agent,
      message: existing ? 'Agent updated successfully' : 'Agent created successfully'
    });
  } catch (error) {
    logger.error('Error creating/updating agent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save agent configuration'
    });
  }
});

/**
 * PATCH /api/agent
 * Partially update agent
 */
router.patch('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await require('../config/database').adminUser.findUnique({
      where: { id: userId },
      select: { plan: true }
    });

    if (!user || user.plan !== 'premium') {
      return res.status(403).json({
        success: false,
        error: 'Premium subscription required'
      });
    }

    const updates = req.body;

    // Validate partial updates
    if (updates.tone) {
      const validTones = ['serious', 'friendly', 'sexy', 'explicit', 'playful', 'professional'];
      if (!validTones.includes(updates.tone)) {
        return res.status(400).json({
          success: false,
          error: `Invalid tone. Must be one of: ${validTones.join(', ')}`
        });
      }
    }

    if (updates.response_style) {
      const validStyles = ['short', 'medium', 'long', 'casual'];
      if (!validStyles.includes(updates.response_style)) {
        return res.status(400).json({
          success: false,
          error: `Invalid response style. Must be one of: ${validStyles.join(', ')}`
        });
      }
    }

    const agent = await agentService.updateAgent(userId, updates);

    res.json({
      success: true,
      agent,
      message: 'Agent updated successfully'
    });
  } catch (error) {
    logger.error('Error updating agent:', error);

    if (error.message === 'Agent not found') {
      return res.status(404).json({
        success: false,
        error: 'Agent not found. Create one first with POST /api/agent'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update agent'
    });
  }
});

/**
 * DELETE /api/agent
 * Delete agent (when downgrading or resetting)
 */
router.delete('/', async (req, res) => {
  try {
    const userId = req.user.id;

    await agentService.deleteAgent(userId);

    res.json({
      success: true,
      message: 'Agent deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting agent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete agent'
    });
  }
});

/**
 * POST /api/agent/regenerate
 * Regenerate system prompt
 */
router.post('/regenerate', async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await require('../config/database').adminUser.findUnique({
      where: { id: userId },
      select: { plan: true }
    });

    if (!user || user.plan !== 'premium') {
      return res.status(403).json({
        success: false,
        error: 'Premium subscription required'
      });
    }

    const systemPrompt = await agentService.regenerateSystemPrompt(userId);

    res.json({
      success: true,
      system_prompt: systemPrompt,
      message: 'System prompt regenerated successfully'
    });
  } catch (error) {
    logger.error('Error regenerating system prompt:', error);

    if (error.message === 'Agent not found') {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to regenerate system prompt'
    });
  }
});

/**
 * POST /api/agent/preview
 * Preview system prompt without saving
 */
router.post('/preview', async (req, res) => {
  try {
    const userId = req.user.id;
    const config = req.body;

    // Merge with existing agent if premium user
    const user = await require('../config/database').adminUser.findUnique({
      where: { id: userId },
      select: { plan: true }
    });

    let baseConfig;
    if (user?.plan === 'premium') {
      const existingAgent = await agentService.getAgent(userId);
      baseConfig = existingAgent || agentService.getDefaultConfig();
    } else {
      baseConfig = agentService.getDefaultConfig();
    }

    // Merge with provided config
    const previewConfig = { ...baseConfig, ...config };
    const systemPrompt = agentService.generateSystemPrompt(previewConfig);

    res.json({
      success: true,
      system_prompt: systemPrompt,
      config: {
        name: previewConfig.name,
        tone: previewConfig.tone,
        response_style: previewConfig.response_style,
        engagement_level: previewConfig.engagement_level,
        language: previewConfig.language
      }
    });
  } catch (error) {
    logger.error('Error generating preview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate preview'
    });
  }
});

/**
 * GET /api/agent/templates
 * Get available agent templates
 */
router.get('/templates', async (req, res) => {
  try {
    const templates = await require('../config/database').agentTemplate.findMany({
      where: { is_active: true },
      orderBy: { category: 'asc' }
    });

    res.json({
      success: true,
      templates
    });
  } catch (error) {
    logger.error('Error getting templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get templates'
    });
  }
});

/**
 * POST /api/agent/clone/:templateId
 * Clone agent from template
 */
router.post('/clone/:templateId', async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await require('../config/database').adminUser.findUnique({
      where: { id: userId },
      select: { plan: true }
    });

    if (!user || user.plan !== 'premium') {
      return res.status(403).json({
        success: false,
        error: 'Premium subscription required'
      });
    }

    const templateId = parseInt(req.params.templateId);
    const agent = await agentService.cloneFromTemplate(userId, templateId);

    res.json({
      success: true,
      agent,
      message: 'Agent created from template successfully'
    });
  } catch (error) {
    logger.error('Error cloning from template:', error);

    if (error.message === 'Template not found') {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to clone agent from template'
    });
  }
});

/**
 * GET /api/agent/memory/:contactId
 * Get conversation memory for a contact
 */
router.get('/memory/:contactId', async (req, res) => {
  try {
    const userId = req.user.id;
    const contactId = parseInt(req.params.contactId);

    const agent = await agentService.getAgent(userId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    const memory = await agentMemoryService.getMemory(agent.id, contactId);

    res.json({
      success: true,
      memory
    });
  } catch (error) {
    logger.error('Error getting memory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get memory'
    });
  }
});

/**
 * PUT /api/agent/memory/:contactId
 * Update memory key facts manually
 */
router.put('/memory/:contactId', async (req, res) => {
  try {
    const userId = req.user.id;
    const contactId = parseInt(req.params.contactId);
    const facts = req.body;

    const agent = await agentService.getAgent(userId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    const memory = await agentMemoryService.updateKeyFacts(agent.id, contactId, facts);

    res.json({
      success: true,
      memory,
      message: 'Memory updated successfully'
    });
  } catch (error) {
    logger.error('Error updating memory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update memory'
    });
  }
});

/**
 * DELETE /api/agent/memory/:contactId
 * Clear memory for a contact
 */
router.delete('/memory/:contactId', async (req, res) => {
  try {
    const userId = req.user.id;
    const contactId = parseInt(req.params.contactId);

    const agent = await agentService.getAgent(userId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    await agentMemoryService.clearMemory(agent.id, contactId);

    res.json({
      success: true,
      message: 'Memory cleared successfully'
    });
  } catch (error) {
    logger.error('Error clearing memory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear memory'
    });
  }
});

/**
 * GET /api/agent/memories
 * Get all memories for analytics
 */
router.get('/memories', async (req, res) => {
  try {
    const userId = req.user.id;

    const agent = await agentService.getAgent(userId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    const memories = await agentMemoryService.getAgentMemories(agent.id);

    res.json({
      success: true,
      memories,
      count: memories.length
    });
  } catch (error) {
    logger.error('Error getting memories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get memories'
    });
  }
});

/**
 * GET /api/agent/high-intent
 * Get contacts with high purchase intent
 */
router.get('/high-intent', async (req, res) => {
  try {
    const userId = req.user.id;
    const threshold = parseFloat(req.query.threshold) || 0.7;

    const agent = await agentService.getAgent(userId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    const contacts = await agentMemoryService.getHighIntentContacts(agent.id, threshold);

    res.json({
      success: true,
      contacts,
      count: contacts.length,
      threshold
    });
  } catch (error) {
    logger.error('Error getting high intent contacts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get high intent contacts'
    });
  }
});

module.exports = router;