const OpenAI = require('openai');
const prisma = require('../config/database');
const configService = require('./config.service');
const setupService = require('./setup.service');
const userCredentialsService = require('./userCredentials.service');
const apiKeyService = require('./apiKey.service');
const { ExternalServiceError, ValidationError, NotFoundError } = require('../utils/errors');
const logger = require('../utils/logger');

// AI output schema validation
const VALID_FORMALITY = ['low', 'medium', 'high'];
const VALID_EMOJI_USAGE = ['low', 'medium', 'high'];
const VALID_MESSAGE_LENGTH = ['short', 'medium', 'long'];
const VALID_SALES_APPROACH = ['soft', 'direct', 'aggressive'];
const VALID_UPSELL_FREQUENCY = ['low', 'medium', 'high'];
const VALID_CTA_STYLE = ['subtle', 'persuasive', 'urgent'];

// Map AI output tone to existing BotConfig tones
const TONE_MAPPING = {
  'serious': 'serious',
  'professional': 'serious',
  'formal': 'serious',
  'friendly': 'friendly',
  'casual': 'friendly',
  'sexy': 'sexy',
  'flirty': 'sexy',
  'explicit': 'explicit',
  'adult': 'explicit',
  'playful': 'playful'
};

// Valid tones for AI output (what the AI can suggest)
const VALID_AI_TONES = ['serious', 'professional', 'friendly', 'sexy', 'explicit', 'playful'];

// Language detection
const detectLanguage = (text) => {
  const lowerText = text.toLowerCase();
  const englishWords = ['the', 'is', 'are', 'you', 'how', 'what', 'can', 'have', 'want', 'like', 'business', 'sell', 'product', 'service', 'customers', 'brand'];
  const spanishWords = ['qué', 'como', 'hola', 'negocio', 'vender', 'producto', 'tienes', 'haces', 'eres', 'estás', 'clientes', 'marca', 'servicio', 'vendo', 'mi'];

  let englishCount = 0;
  let spanishCount = 0;

  const words = lowerText.split(/\s+/);
  words.forEach(word => {
    if (englishWords.includes(word)) englishCount++;
    if (spanishWords.includes(word)) spanishCount++;
  });

  return englishCount > spanishCount ? 'en' : 'es';
};

// Validate AI output
const validateAIOutput = (output) => {
  const errors = [];

  if (!output || typeof output !== 'object') {
    return 'Invalid output: must be an object';
  }

  if (!VALID_AI_TONES.includes(output.tone)) {
    errors.push(`Invalid tone: ${output.tone}. Must be one of: ${VALID_AI_TONES.join(', ')}`);
  }

  if (output.communication_style) {
    if (!VALID_FORMALITY.includes(output.communication_style.formality)) {
      errors.push(`Invalid formality: ${output.communication_style.formality}`);
    }
    if (!VALID_EMOJI_USAGE.includes(output.communication_style.emoji_usage)) {
      errors.push(`Invalid emoji_usage: ${output.communication_style.emoji_usage}`);
    }
    if (!VALID_MESSAGE_LENGTH.includes(output.communication_style.message_length)) {
      errors.push(`Invalid message_length: ${output.communication_style.message_length}`);
    }
  }

  if (output.sales_strategy) {
    if (!VALID_SALES_APPROACH.includes(output.sales_strategy.approach)) {
      errors.push(`Invalid sales approach: ${output.sales_strategy.approach}`);
    }
    if (!VALID_UPSELL_FREQUENCY.includes(output.sales_strategy.upsell_frequency)) {
      errors.push(`Invalid upsell_frequency: ${output.sales_strategy.upsell_frequency}`);
    }
    if (!VALID_CTA_STYLE.includes(output.sales_strategy.call_to_action_style)) {
      errors.push(`Invalid call_to_action_style: ${output.sales_strategy.call_to_action_style}`);
    }
  }

  // Validate products if present
  if (output.products && Array.isArray(output.products)) {
    output.products.forEach((product, idx) => {
      if (!product.name || typeof product.name !== 'string') {
        errors.push(`Product ${idx + 1}: name is required`);
      }
    });
  }

  return errors.length === 0 ? null : errors.join(', ');
};

// Build system prompt for AI config generation
const buildConfigSystemPrompt = (language) => {
  const isSpanish = language === 'es';

  if (isSpanish) {
    return `Eres un experto en configurar chatbots de IA para ventas y engagement con clientes.
Dada una descripción del negocio, genera la configuración óptima para el bot.

IMPORTANTE: Responde SOLO con JSON válido. Sin explicaciones, sin markdown, solo JSON puro.

La salida debe coincidir exactamente con esta estructura:
{
  "tone": "serious | friendly | sexy | explicit | playful",
  "communication_style": {
    "formality": "low | medium | high",
    "emoji_usage": "low | medium | high",
    "message_length": "short | medium | long"
  },
  "sales_strategy": {
    "approach": "soft | direct | aggressive",
    "upsell_frequency": "low | medium | high",
    "call_to_action_style": "subtle | persuasive | urgent"
  },
  "products": [
    {
      "name": "Nombre del producto/servicio",
      "description": "Descripción breve (máx 50 palabras)",
      "price_range": "Precio o \"Consultar\" si no se especifica",
      "category": "categoría (ej: contenido, servicio, producto)"
    }
  ],
  "target_audience": "string describiendo al cliente ideal",
  "business_type": "string describiendo el tipo de negocio",
  "example_messages": ["Ejemplo de respuesta 1", "Ejemplo de respuesta 2"],
  "restricted_topics": ["tema1", "tema2"],
  "language": "es"
}

Directrices para seleccionar el tono:
- "serious": Para servicios profesionales (fotografía de bodas, consultoría, servicios legales, médicos). Sin términos de cariño, tono formal.
- "friendly": Para negocios casuales, e-commerce, servicios generales. Tono cercano pero profesional.
- "sexy": Para contenido coqueto, OnlyFans no explícito, modelos. Tono sugerente pero sin contenido explícito.
- "explicit": Para contenido adulto explícito, contenido +18. Sin restricciones de lenguaje sexual.
- "playful": Para contenido divertido, memes, entretenimiento. Tono juguetón y ligero.

Otras directrices:
- Para servicios profesionales: formalidad "medium" o "high", emoji_usage "low"
- Para contenido adulto: formalidad "low", emoji_usage "medium" o "high"
- Configura message_length como "short" para apps de chat
- PRODUCTOS: Genera entre 3-8 productos/servicios basados en la descripción

REGLAS IMPORTANTES PARA PRECIOS:
- NUNCA inventes precios. Si el usuario NO menciona precios específicos, usa "Consultar"
- Solo incluye precios EXACTOS si el usuario los especifica claramente
- Ejemplos: "$500", "$100-200", "Desde $50", "$30/mes", "Consultar"
- NO asumas rangos de precios típicos del mercado`;
  }

  return `You are an expert at configuring AI chatbots for sales and customer engagement.
Given a business description, generate optimal bot configuration settings.

IMPORTANT: Respond ONLY with valid JSON. No explanations, no markdown, just pure JSON.

Output must match this exact structure:
{
  "tone": "serious | friendly | sexy | explicit | playful",
  "communication_style": {
    "formality": "low | medium | high",
    "emoji_usage": "low | medium | high",
    "message_length": "short | medium | long"
  },
  "sales_strategy": {
    "approach": "soft | direct | aggressive",
    "upsell_frequency": "low | medium | high",
    "call_to_action_style": "subtle | persuasive | urgent"
  },
  "products": [
    {
      "name": "Product/Service name",
      "description": "Brief description (max 50 words)",
      "price_range": "Price or \"Inquire\" if not specified",
      "category": "category (e.g: content, service, product)"
    }
  ],
  "target_audience": "string describing the ideal customer",
  "business_type": "string describing the business type",
  "example_messages": ["Example response 1", "Example response 2"],
  "restricted_topics": ["topic1", "topic2"],
  "language": "en"
}

Tone selection guidelines:
- "serious": For professional services (wedding photography, consulting, legal, medical). No terms of endearment, formal tone.
- "friendly": For casual businesses, e-commerce, general services. Approachable but professional.
- "sexy": For flirtatious content, non-explicit OnlyFans, models. Suggestive but not explicit content.
- "explicit": For adult explicit content, +18 content. No restrictions on sexual language.
- "playful": For fun content, memes, entertainment. Playful and lighthearted.

Other guidelines:
- For professional services: formality "medium" or "high", emoji_usage "low"
- For adult content: formality "low", emoji_usage "medium" or "high"
- Set message_length to "short" for chat apps
- PRODUCTS: Generate 3-8 products/services based on the business description

IMPORTANT PRICE RULES:
- NEVER invent prices. If user does NOT mention specific prices, use "Inquire"
- Only include EXACT prices if user specifies them clearly
- Examples: "$500", "$100-200", "From $50", "$30/month", "Inquire"
- DO NOT assume typical market price ranges`;
};

// Generate AI configuration from description
const generateConfigFromDescription = async (description, language = null, userId = null, ownerId = null) => {
  // Get AI credentials - try new dual API key system first
  let apiKey, provider;

  const effectiveUserId = ownerId || userId;

  try {
    const keyInfo = await apiKeyService.getApiKeyForUser(effectiveUserId);
    apiKey = keyInfo.apiKey;
    provider = keyInfo.provider;
    logger.debug(`AI Config: Using ${keyInfo.keyType} API key for user ${effectiveUserId}`);
  } catch (keyError) {
    logger.debug('AI Config: Key service error, trying fallbacks:', keyError.message);

    // Fallback: try legacy credential system
    let aiCreds = null;
    if (ownerId) {
      aiCreds = await userCredentialsService.getAICredentials(ownerId);
    }
    if (!aiCreds && userId) {
      aiCreds = await userCredentialsService.getAICredentials(userId);
    }
    if (!aiCreds || !aiCreds.apiKey) {
      aiCreds = await setupService.getAICredentials();
    }

    if (aiCreds && aiCreds.apiKey) {
      apiKey = aiCreds.apiKey;
      provider = aiCreds.provider || 'groq';
    }
  }

  if (!apiKey) {
    throw new ExternalServiceError(
      'AI API key not configured. Please go to Settings > Setup to configure your Groq or OpenAI API key.',
      'AI'
    );
  }

  // Detect language if not provided
  const detectedLanguage = language || detectLanguage(description);

  const systemPrompt = buildConfigSystemPrompt(detectedLanguage);

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: provider === 'groq' ? 'https://api.groq.com/openai/v1' : undefined
  });

  try {
    logger.info(`Generating AI config for description: "${description.substring(0, 50)}..."`);

    const completion = await client.chat.completions.create({
      model: provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Business description: ${description}` }
      ],
      max_tokens: 1000,
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const rawOutput = completion.choices[0]?.message?.content;

    if (!rawOutput) {
      throw new ExternalServiceError('Empty response from AI', provider);
    }

    let aiOutput;
    try {
      aiOutput = JSON.parse(rawOutput);
    } catch (parseError) {
      logger.error('Failed to parse AI output:', rawOutput);
      throw new ValidationError('AI returned invalid JSON. Please try again.');
    }

    // Ensure language is set
    aiOutput.language = detectedLanguage;

    // Validate output
    const validationError = validateAIOutput(aiOutput);
    if (validationError) {
      logger.error('AI output validation failed:', validationError);
      throw new ValidationError(`AI generated invalid config: ${validationError}`);
    }

    // Store generation in database
    const generation = await prisma.aIConfigGeneration.create({
      data: {
        user_id: userId,
        description,
        generated_config: aiOutput,
        status: 'draft'
      }
    });

    logger.info(`AI config generated successfully, generation ID: ${generation.id}`);

    return {
      generationId: generation.id,
      config: aiOutput,
      detectedLanguage
    };
  } catch (error) {
    if (error instanceof ValidationError || error instanceof ExternalServiceError) {
      throw error;
    }
    logger.error('AI config generation error:', error);

    // Handle specific error cases
    if (error.message?.includes('401') || error.message?.includes('Invalid API Key') || error.status === 401) {
      throw new ExternalServiceError(
        'Invalid API key. Please check your API key in Settings > Setup. Make sure you have a valid Groq or OpenAI API key.',
        provider || 'AI'
      );
    }

    if (error.message?.includes('429') || error.status === 429) {
      throw new ExternalServiceError(
        'API rate limit exceeded. Please wait a moment and try again.',
        provider || 'AI'
      );
    }

    throw new ExternalServiceError(
      error.message || 'Failed to generate configuration. Please try again.',
      provider || 'AI'
    );
  }
};

// Apply AI-generated config to BotConfig
const applyGeneratedConfig = async (generationId, editedConfig = null, userId = null) => {
  const generation = await prisma.aIConfigGeneration.findUnique({
    where: { id: generationId }
  });

  if (!generation) {
    throw new NotFoundError('Generation not found');
  }

  const configToApply = editedConfig || generation.generated_config;

  // Map AI output to BotConfig fields
  const botConfigUpdate = {
    tone: TONE_MAPPING[configToApply.tone] || 'playful',
    personality: configToApply.target_audience
      ? `Target: ${configToApply.target_audience}. ${configToApply.business_type || ''}`.trim()
      : (configToApply.business_type || ''),
    engagement_level: configToApply.sales_strategy?.upsell_frequency === 'high' ? 5 :
                      configToApply.sales_strategy?.upsell_frequency === 'medium' ? 3 : 2,
    message_style: JSON.stringify([
      configToApply.communication_style?.message_length === 'short' ? 'short' : null,
      configToApply.communication_style?.emoji_usage !== 'low' ? 'emoji' : null,
      'casual'
    ].filter(Boolean)),
    sales_strategy: configToApply.sales_strategy
      ? `Approach: ${configToApply.sales_strategy.approach}. CTA style: ${configToApply.sales_strategy.call_to_action_style}.`
      : null,
    restrictions: configToApply.restricted_topics?.filter(t => t && t.trim()).length > 0
      ? configToApply.restricted_topics.filter(t => t && t.trim()).join('. ')
      : null,
    products: configToApply.products?.length > 0
      ? configToApply.products.map(p => p.name).join(',')
      : null,
    ai_generated: true,
    ai_description: generation.description
  };

  // Update BotConfig
  const updatedConfig = await configService.updateConfig(botConfigUpdate);

  // Create Product records for each product in AI output
  if (configToApply.products && Array.isArray(configToApply.products) && configToApply.products.length > 0) {
    logger.info(`Creating ${configToApply.products.length} products from AI generation`);

    for (const product of configToApply.products) {
      if (product.name && product.name.trim()) {
        // Check if product already exists
        const existingProduct = await prisma.product.findFirst({
          where: {
            name: product.name.trim(),
            owner_user_id: userId || 1
          }
        });

        if (!existingProduct) {
          // Create new product
          await prisma.product.create({
            data: {
              name: product.name.trim(),
              description: product.description || '',
              price: product.price_range && product.price_range !== 'Consultar'
                ? parseFloat(product.price_range.replace(/[^0-9.]/g, '')) || null
                : null,
              type: product.category || 'service',
              owner_user_id: userId || 1,
              is_active: true
            }
          });
          logger.debug(`Created product: ${product.name}`);
        }
      }
    }
  }

  // Mark generation as applied
  await prisma.aIConfigGeneration.update({
    where: { id: generationId },
    data: { status: 'applied' }
  });

  logger.info(`AI config generation ${generationId} applied to BotConfig`);

  return updatedConfig;
};

// Regenerate with tweaks
const regenerateConfig = async (generationId, tweakInstruction, userId = null, ownerId = null) => {
  const originalGeneration = await prisma.aIConfigGeneration.findUnique({
    where: { id: generationId }
  });

  if (!originalGeneration) {
    throw new NotFoundError('Original generation not found');
  }

  // Get AI credentials - try new dual API key system first
  let apiKey, provider;

  const effectiveUserId = ownerId || userId;

  try {
    const keyInfo = await apiKeyService.getApiKeyForUser(effectiveUserId);
    apiKey = keyInfo.apiKey;
    provider = keyInfo.provider;
    logger.debug(`AI Config Regenerate: Using ${keyInfo.keyType} API key for user ${effectiveUserId}`);
  } catch (keyError) {
    logger.debug('AI Config Regenerate: Key service error, trying fallbacks:', keyError.message);

    // Fallback: try legacy credential system
    let aiCreds = null;
    if (ownerId) aiCreds = await userCredentialsService.getAICredentials(ownerId);
    if (!aiCreds && userId) aiCreds = await userCredentialsService.getAICredentials(userId);
    if (!aiCreds || !aiCreds.apiKey) aiCreds = await setupService.getAICredentials();

    if (aiCreds && aiCreds.apiKey) {
      apiKey = aiCreds.apiKey;
      provider = aiCreds.provider || 'groq';
    }
  }

  if (!apiKey) {
    throw new ExternalServiceError(
      'AI API key not configured. Please go to Settings > Setup to configure your Groq or OpenAI API key.',
      'AI'
    );
  }

  const language = originalGeneration.generated_config?.language || 'en';
  const systemPrompt = buildConfigSystemPrompt(language);

  const tweakPrompt = `Previous configuration:
${JSON.stringify(originalGeneration.generated_config, null, 2)}

User feedback/tweak instruction: "${tweakInstruction}"

CRITICAL INSTRUCTIONS:
1. Follow the user's feedback EXACTLY. Make ONLY the changes they requested.
2. If the user mentions specific prices, use those exact prices.
3. If the user does NOT mention prices, keep existing prices or use "Consultar"/"Inquire".
4. If the user wants to add products, add them to the existing list.
5. If the user wants to remove products, remove them from the list.
6. If the user wants to modify specific fields, ONLY modify those fields.
7. Preserve all other configuration that wasn't explicitly changed.

Please modify the configuration based on the user's feedback. Keep the same JSON structure.`;

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: provider === 'groq' ? 'https://api.groq.com/openai/v1' : undefined
  });

  try {
    logger.info(`Regenerating config ${generationId} with tweak: "${tweakInstruction}"`);

    const completion = await client.chat.completions.create({
      model: provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: tweakPrompt }
      ],
      max_tokens: 1000,
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const rawOutput = completion.choices[0]?.message?.content;

    if (!rawOutput) {
      throw new ExternalServiceError('Empty response from AI', provider);
    }

    let aiOutput;
    try {
      aiOutput = JSON.parse(rawOutput);
    } catch (parseError) {
      throw new ValidationError('AI returned invalid JSON. Please try again.');
    }

    // Ensure language is preserved
    aiOutput.language = language;

    // Validate output
    const validationError = validateAIOutput(aiOutput);
    if (validationError) {
      throw new ValidationError(`AI generated invalid config: ${validationError}`);
    }

    // Store new generation
    const newGeneration = await prisma.aIConfigGeneration.create({
      data: {
        user_id: userId,
        description: originalGeneration.description,
        generated_config: aiOutput,
        status: 'draft'
      }
    });

    logger.info(`New AI config generated, ID: ${newGeneration.id}`);

    return {
      generationId: newGeneration.id,
      config: aiOutput
    };
  } catch (error) {
    if (error instanceof ValidationError || error instanceof ExternalServiceError) {
      throw error;
    }
    logger.error('AI config regeneration error:', error);

    // Handle specific error cases
    if (error.message?.includes('401') || error.message?.includes('Invalid API Key') || error.status === 401) {
      throw new ExternalServiceError(
        'Invalid API key. Please check your API key in Settings > Setup.',
        provider || 'AI'
      );
    }

    if (error.message?.includes('429') || error.status === 429) {
      throw new ExternalServiceError(
        'API rate limit exceeded. Please wait a moment and try again.',
        provider || 'AI'
      );
    }

    throw new ExternalServiceError(
      error.message || 'Failed to regenerate configuration. Please try again.',
      provider || 'AI'
    );
  }
};

// Get generation history
const getGenerationHistory = async (limit = 10) => {
  const history = await prisma.aIConfigGeneration.findMany({
    orderBy: { created_at: 'desc' },
    take: limit
  });

  return history;
};

module.exports = {
  generateConfigFromDescription,
  applyGeneratedConfig,
  regenerateConfig,
  getGenerationHistory,
  validateAIOutput,
  TONE_MAPPING
};