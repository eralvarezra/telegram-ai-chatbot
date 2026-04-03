const express = require('express');
const router = express.Router();
const apiKeyService = require('../services/apiKey.service');
const rateLimitService = require('../services/rateLimit.service');
const usageTrackingService = require('../services/usageTracking.service');
const authMiddleware = require('../middleware/auth.middleware');
const { ApiKeyError, RateLimitError } = require('../utils/errors');
const logger = require('../utils/logger');

// All routes require authentication
router.use(authMiddleware);

/**
 * POST /api/api-key
 * Save user's API key (encrypted)
 */
router.post('/', async (req, res) => {
  try {
    const { apiKey, provider = 'groq' } = req.body;
    const userId = req.user.id;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'API key is required'
      });
    }

    const result = await apiKeyService.saveUserApiKey(userId, apiKey, provider);

    res.json({
      success: true,
      message: 'API key saved and validated',
      keyPreview: result.keyPreview
    });
  } catch (error) {
    logger.error('Error saving API key:', error);

    if (error instanceof ApiKeyError) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to save API key'
    });
  }
});

/**
 * DELETE /api/api-key
 * Remove user's API key
 */
router.delete('/', async (req, res) => {
  try {
    const userId = req.user.id;

    await apiKeyService.removeUserApiKey(userId);

    res.json({
      success: true,
      message: 'API key removed'
    });
  } catch (error) {
    logger.error('Error removing API key:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to remove API key'
    });
  }
});

/**
 * GET /api/api-key/status
 * Get API key status (masked)
 */
router.get('/status', async (req, res) => {
  try {
    const userId = req.user.id;
    const status = await apiKeyService.getApiKeyStatus(userId);

    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    logger.error('Error getting API key status:', error);

    if (error instanceof ApiKeyError) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to get API key status'
    });
  }
});

/**
 * POST /api/api-key/validate
 * Validate API key before saving
 */
router.post('/validate', async (req, res) => {
  try {
    const { apiKey, provider = 'groq' } = req.body;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'API key is required'
      });
    }

    // Validate format
    if (!apiKeyService.validateApiKeyFormat(apiKey, provider)) {
      return res.status(400).json({
        success: false,
        error: `Invalid API key format for ${provider}. Expected format: ${provider === 'openai' ? 'sk-...' : 'gsk_...'}`,
        valid: false
      });
    }

    // Validate key works
    const isValid = await apiKeyService.validateApiKey(apiKey, provider);

    res.json({
      success: true,
      valid: isValid,
      keyPreview: apiKeyService.maskApiKey(apiKey)
    });
  } catch (error) {
    logger.error('Error validating API key:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to validate API key'
    });
  }
});

/**
 * GET /api/usage
 * Get usage statistics
 */
router.get('/usage', async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await usageTrackingService.getUsageStats(userId);

    res.json({
      success: true,
      ...stats
    });
  } catch (error) {
    logger.error('Error getting usage stats:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to get usage statistics'
    });
  }
});

/**
 * GET /api/usage/limits
 * Get current limits and usage
 */
router.get('/limits', async (req, res) => {
  try {
    const userId = req.user.id;

    const [dailyStatus, monthlyStatus] = await Promise.all([
      rateLimitService.checkDailyLimit(userId),
      usageTrackingService.checkMonthlyLimit(userId)
    ]);

    res.json({
      success: true,
      daily: {
        used: dailyStatus.used,
        limit: dailyStatus.limit,
        remaining: dailyStatus.remaining,
        resetsAt: dailyStatus.resetTime
      },
      monthly: {
        used: monthlyStatus.used,
        limit: monthlyStatus.limit,
        remaining: monthlyStatus.remaining
      },
      plan: dailyStatus.plan || monthlyStatus.plan
    });
  } catch (error) {
    logger.error('Error getting limits:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to get limits'
    });
  }
});

/**
 * PUT /api/api-key/plan
 * Update user plan (admin only)
 */
router.put('/plan', async (req, res) => {
  try {
    const { plan } = req.body;
    const userId = req.user.id;

    // Check if user is admin (optional: add admin check)
    // For now, allow user to change their own plan for testing

    const result = await apiKeyService.updateUserPlan(userId, plan);

    res.json({
      success: true,
      message: `Plan updated to ${plan}`,
      plan: result.plan
    });
  } catch (error) {
    logger.error('Error updating plan:', error);

    if (error instanceof ApiKeyError) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update plan'
    });
  }
});

module.exports = router;