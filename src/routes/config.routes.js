const express = require('express');
const router = express.Router();
const configService = require('../services/config.service');
const apiKeyService = require('../services/apiKey.service');
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

// Get bot config
router.get('/bot-config', async (req, res) => {
  try {
    const config = await configService.getConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update bot config (requires authentication)
router.put('/bot-config', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const config = await configService.updateConfig(req.body);
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get personality config
router.get('/personality', async (req, res) => {
  try {
    const config = await configService.getPersonalityConfig();
    res.json(config);
  } catch (error) {
    console.error('Error fetching personality config:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Update personality config (requires authentication)
router.post('/personality', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const config = await configService.updatePersonalityConfig(req.body);
    res.json(config);
  } catch (error) {
    console.error('Error updating personality config:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Generate personality configuration with AI
router.post('/generate-personality', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Debug: log available API keys
    logger.debug('PLATFORM_GROQ_KEY:', process.env.PLATFORM_GROQ_KEY ? process.env.PLATFORM_GROQ_KEY.substring(0, 15) + '...' : 'not set');
    logger.debug('AI_API_KEY:', process.env.AI_API_KEY ? process.env.AI_API_KEY.substring(0, 15) + '...' : 'not set');

    const { botName, businessDescription } = req.body;

    if (!botName || !businessDescription) {
      return res.status(400).json({ error: 'Bot name and business description are required' });
    }

    // Get API key for AI generation - try multiple sources
    let apiKey, provider, keySource;

    // First try: get from user's plan (premium users use platform key)
    try {
      const keyInfo = await apiKeyService.getApiKeyForUser(userId);
      apiKey = keyInfo.apiKey;
      provider = keyInfo.provider;
      keySource = keyInfo.keyType;
      logger.debug(`Got API key for user ${userId}: ${keyInfo.keyType}`);
    } catch (userKeyError) {
      logger.debug('User key error, trying fallbacks:', userKeyError.message);

      // Second try: environment variables
      apiKey = process.env.PLATFORM_GROQ_KEY || process.env.AI_API_KEY;
      provider = 'groq';
      keySource = 'env';

      // Third try: legacy setup service
      if (!apiKey) {
        const setupCreds = await require('../services/setup.service').getAICredentials();
        if (setupCreds) {
          apiKey = setupCreds.apiKey;
          provider = setupCreds.provider || 'groq';
          keySource = 'setup';
        }
      }
    }

    if (!apiKey) {
      return res.status(400).json({ error: 'No API key available. Please configure your API key or contact support.' });
    }

    logger.info(`Using API key for generation: ${apiKey ? apiKey.substring(0, 10) + '...' : 'none'}`);
    logger.info(`Key source: ${keySource}`);

    // Generate personality configuration using AI
    const prompt = `You are helping configure a Telegram bot for a business. Based on the following information, generate a complete bot configuration in JSON format.

Bot Name: ${botName}
Business Description: ${businessDescription}

Generate a JSON object with these exact fields:
{
  "personality": "A detailed personality description (2-3 sentences)",
  "products": "Product1,Product2,Product3 (comma-separated list)",
  "response_style": "short",
  "tone": "playful",
  "engagement_level": 3,
  "payment_confirm_message": "A friendly payment confirmation message in Spanish"
}

Rules:
- tone must be one of: playful, professional, seductive, friendly
- response_style must be: short
- engagement_level must be a number 1-5
- All text content should be in Spanish
- The personality should match the business type and style described

Respond ONLY with the JSON object, no markdown or explanation.`;

    // Call Groq API using OpenAI SDK (more reliable)
    const OpenAI = require('openai');
    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.groq.com/openai/v1'
    });

    let completion;
    try {
      completion = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that generates bot configurations. You only respond with valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 500
      });
    } catch (apiError) {
      logger.error('Groq API error:', apiError.message);
      logger.error('API key used:', apiKey ? apiKey.substring(0, 15) + '...' : 'none');
      throw apiError;
    }

    const aiResponse = completion.choices[0]?.message?.content || '';

    let config;
    try {
      // Parse AI response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        config = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      logger.warn('Failed to parse AI response, using defaults:', parseError.message);
      // Fallback to default configuration
      config = {
        personality: `${businessDescription}`,
        products: 'Productos y servicios',
        response_style: 'short',
        tone: 'playful',
        engagement_level: 3,
        payment_confirm_message: '¡Gracias por tu compra! Te avisaré cuando esté listo.'
      };
    }

    // Save configuration
    const savedConfig = await configService.updateConfig({
      bot_name: botName,
      personality: config.personality || businessDescription,
      products: Array.isArray(config.products)
        ? config.products.map(p => p.name || p).join(',')
        : config.products || '',
      response_style: config.response_style || 'short',
      tone: config.tone || 'playful',
      engagement_level: config.engagement_level || 3,
      payment_confirm_message: config.payment_confirm_message || '',
      typing_delay: true,
      typing_speed_min: 200,
      typing_speed_max: 400,
      media_keyword_trigger: true
    });

    // Create Product records from AI-generated products
    if (config.products && Array.isArray(config.products) && config.products.length > 0) {
      const prisma = require('../config/database');

      logger.info(`Creating ${config.products.length} products from AI generation`);

      for (const product of config.products) {
        const productName = product.name || product;
        if (productName && productName.trim()) {
          // Check if product already exists
          const existingProduct = await prisma.product.findFirst({
            where: {
              name: productName.trim(),
              owner_user_id: userId || 1
            }
          });

          if (!existingProduct) {
            // Create new product
            await prisma.product.create({
              data: {
                name: productName.trim(),
                description: product.description || '',
                price: product.price_range && product.price_range !== 'Consultar'
                  ? parseFloat(String(product.price_range).replace(/[^0-9.]/g, '')) || null
                  : null,
                type: product.category || 'service',
                owner_user_id: userId || 1,
                is_active: true
              }
            });
            logger.debug(`Created product: ${productName}`);
          }
        }
      }
    }

    logger.info(`Generated personality config for bot: ${botName}`);

    res.json({
      success: true,
      config: savedConfig,
      generated: config
    });
  } catch (error) {
    console.error('Error generating personality:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;