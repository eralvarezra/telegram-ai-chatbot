const OpenAI = require('openai');
const configService = require('./config.service');
const setupService = require('./setup.service');
const userCredentialsService = require('./userCredentials.service');
const toneService = require('./tone.service');
const apiKeyService = require('./apiKey.service');
const usageTrackingService = require('./usageTracking.service');
const agentService = require('./agent.service');
const agentMemoryService = require('./agentMemory.service');
const { ExternalServiceError } = require('../utils/errors');
const logger = require('../utils/logger');

// Tone configurations (for bot personality)
const TONE_CONFIGS = {
  serious: {
    description: 'Profesional, formal, serio',
    terms: {
      female: { es: ['señora', 'usted'], en: ['ma\'am', 'you'] },
      male: { es: ['señor', 'usted'], en: ['sir', 'you'] },
      auto: { es: ['usted'], en: ['you'] }
    }
  },
  friendly: {
    description: 'Amigable, cálida, cercana',
    terms: {
      female: { es: ['amiga', 'guapa', 'hermosa'], en: ['friend', 'gorgeous', 'beautiful'] },
      male: { es: ['amigo', 'guapo'], en: ['friend', 'buddy', 'handsome'] },
      auto: { es: ['amigo/a'], en: ['friend'] }
    }
  },
  sexy: {
    description: 'Sexy, coqueto, sugerente',
    terms: {
      female: { es: ['bb', 'guapa', 'mami', 'hermosa'], en: ['babe', 'gorgeous', 'beautiful', 'hun'] },
      male: { es: ['bb', 'guapo', 'papacito', 'amor'], en: ['babe', 'handsome', 'daddy', 'love'] },
      auto: { es: ['bb', 'guapo/a'], en: ['babe', 'handsome/beautiful'] }
    }
  },
  explicit: {
    description: 'Explícito, sensual, atrevido (+18)',
    terms: {
      female: { es: ['bb', 'guapa', 'mami rica', 'hermosa'], en: ['babe', 'gorgeous', 'sexy', 'beautiful'] },
      male: { es: ['bb', 'guapo', 'papi rico', 'amor'], en: ['babe', 'handsome', 'daddy', 'love'] },
      auto: { es: ['bb', 'rico/a'], en: ['babe', 'sexy'] }
    }
  },
  playful: {
    description: 'Juguetona, divertida, coqueta',
    terms: {
      female: { es: ['bb', 'guapa', 'mami', 'amor'], en: ['babe', 'gorgeous', 'beautiful', 'love'] },
      male: { es: ['bb', 'guapo', 'papacito', 'amor'], en: ['babe', 'handsome', 'daddy', 'love'] },
      auto: { es: ['bb', 'guapo', 'papacito', 'amor'], en: ['babe', 'handsome', 'daddy', 'love'] }
    }
  }
};

// Detect language from text
const detectLanguage = (text) => {
  const lowerText = text.toLowerCase();
  const englishWords = ['the', 'is', 'you', 'how', 'what', 'can', 'want', 'like', 'hello', 'hey', 'babe', 'daddy', 'love', 'please', 'send', 'pics', 'much', 'price', 'pay'];
  const spanishWords = ['qué', 'como', 'hola', 'bb', 'papacito', 'guapo', 'amor', 'cuánto', 'precio', 'pagar', 'quiero', 'tienes', 'envía', 'fotos', 'eres', 'estás'];
  const portugueseWords = ['olá', 'oi', 'como', 'quanto', 'preço', 'pagar', 'quero', 'você', 'tem', 'envia', 'fotos', 'muito', 'bem', 'lindo'];

  let englishCount = 0, spanishCount = 0, portugueseCount = 0;
  const words = lowerText.split(/\s+/);

  words.forEach(word => {
    if (englishWords.includes(word)) englishCount++;
    if (spanishWords.includes(word)) spanishCount++;
    if (portugueseWords.includes(word)) portugueseCount++;
  });

  if (/\b(i'm|you're|don't|can't|won't|would|could)\b/i.test(text)) englishCount += 2;
  if (/\b(estás|eres|tienes|puedes|quién|cuál|cómo|qué)\b/i.test(text)) spanishCount += 2;
  if (/\b(você|está|pode|quem|qual|como)\b/i.test(text)) portugueseCount += 2;

  if (englishCount > spanishCount && englishCount > portugueseCount) return 'english';
  if (spanishCount > englishCount && spanishCount > portugueseCount) return 'spanish';
  if (portugueseCount > englishCount && portugueseCount > spanishCount) return 'portuguese';
  return 'spanish'; // default
};

// Analyze conversation history
const analyzeConversation = (messageHistory) => {
  if (!messageHistory || messageHistory.length === 0) {
    return { isNewConversation: true, primaryLanguage: 'spanish', messageCount: 0 };
  }

  const userMessages = messageHistory.filter(msg => msg.role !== 'assistant');
  let englishCount = 0, spanishCount = 0, portugueseCount = 0;

  userMessages.forEach(msg => {
    const lang = detectLanguage(msg.content);
    if (lang === 'english') englishCount++;
    else if (lang === 'spanish') spanishCount++;
    else if (lang === 'portuguese') portugueseCount++;
  });

  let primaryLanguage = 'spanish';
  if (englishCount > spanishCount && englishCount > portugueseCount) primaryLanguage = 'english';
  else if (portugueseCount > spanishCount && portugueseCount > englishCount) primaryLanguage = 'portuguese';

  return {
    isNewConversation: messageHistory.length < 3,
    primaryLanguage,
    messageCount: messageHistory.length
  };
};

/**
 * Build dynamic system prompt - OPTIMIZED for token efficiency
 */
const buildSystemPrompt = (botConfig, conversationContext = null, detectedTone = null, userGenderMode = 'auto', isSendingMedia = false) => {
  const products = botConfig.products?.split(',').map(p => p.trim()).join(', ') ||
    'Sexting personalizado, Videollamadas privadas, Packs de fotos/videos, Videos personalizados';

  const toneConfig = TONE_CONFIGS[botConfig.tone] || TONE_CONFIGS.playful;
  const isSeriousTone = botConfig.tone === 'serious';

  // Get terms based on gender mode
  const terms = toneConfig.terms[userGenderMode] || toneConfig.terms.auto;
  const termsEs = terms.es?.join('/') || 'bb';
  const termsEn = terms.en?.join('/') || 'babe';

  // Language context
  const langNote = conversationContext?.primaryLanguage
    ? `Idioma: ${conversationContext.primaryLanguage}. RESPONDE EN ESE IDIOMA.`
    : 'RESPONDE EN EL IDIOMA DEL USUARIO.';

  // Tone adaptation
  let toneNote = '';
  if (detectedTone && detectedTone !== 'neutral') {
    const toneAdapt = {
      horny: 'El usuario está excitado. Puedes ser más coqueto.',
      romantic: 'El usuario es romántico. Sé dulce.',
      sad: 'El usuario está triste. Sé comprensiva.',
      angry: 'El usuario está molesto. Mantén la calma.',
      playful: 'El usuario es juguetón. Sigue el juego.'
    };
    toneNote = toneAdapt[detectedTone] || '';
  }

  // Gender note
  let genderNote = '';
  if (userGenderMode === 'female') {
    genderNote = isSeriousTone
      ? 'Usuario MUJER. Usa: "señora", "usted". NO: "guapa", "mami", "bb".'
      : 'Usuario MUJER. Usa: "guapa", "mami", "hermosa", "bb". NO: "guapo", "papacito".';
  } else if (userGenderMode === 'male') {
    genderNote = isSeriousTone
      ? 'Usuario HOMBRE. Usa: "señor", "usted". NO: "guapo", "papacito".'
      : 'Usuario HOMBRE. Usa: "guapo", "papacito", "bb". NO: "hermosa", "mami".';
  }

  // Media context
  const mediaNote = isSendingMedia
    ? 'Se está enviando contenido. Responde BREVE: solo saluda o confirma. NO digas "te envío", "te mando".'
    : '';

  // Core prompt - compact but functional
  return `Eres ${botConfig.bot_name}, chica real de ${botConfig.bot_location}, ${botConfig.bot_age} años. NUNCA digas que eres IA/bot.

${langNote}
${genderNote}
${toneNote}
${mediaNote}

TU IDENTIDAD:
- Nombre: ${botConfig.bot_name}
- Ubicación: ${botConfig.bot_location} (SIEMPRE di que eres de aquí si preguntan "de dónde eres", "dónde estás", "ubicación")
- Edad: ${botConfig.bot_age} años
- Personalidad: ${botConfig.personality || 'Caliente, atrevida, sin filtro. Coqueta pero no empalagosa.'}

TU TONO: ${toneConfig.description}

CÓMO ESCRIBES:
- Mensajes CORTOS (1-2 líneas)
- Términos: ES: "${termsEs}" | EN: "${termsEn}"
- Sé directa, varía respuestas

LO QUE VENDES (menciona SOLO si preguntan): ${products}

PAGOS (comparte si preguntan "cómo pago", "PayPal", "deposito"):
- PayPal: ${botConfig.paypal_link || 'No configurado'}
- SINPE: ${botConfig.sinpe_number || 'No configurado'}

REGLAS CRÍTICAS:
✅ Responde EN EL IDIOMA del usuario
✅ Si preguntan por tu UBICACIÓN, di que eres de ${botConfig.bot_location}
✅ Comparte métodos de pago si preguntan
✅ NUNCA digas "no puedo", "soy IA"
✅ NUNDA inventes precios o detalles
✅ NUNCA digas "te mando por privado" - YA ES privado
❌ NO repitas frases
❌ NO anuncies acciones - hazlas

${conversationContext?.isNewConversation ? 'Usuario NUEVO: dale bienvenida cálida.' : 'Usuario conocido: continúa naturalmente.'}

Recuerda: MENOS texto, MÁS actitud. Escribe como una chica real por chat.`;
};

// Legacy function for backwards compatibility
const generateSystemPrompt = (botConfig, conversationContext = null, detectedTone = null, userGenderMode = 'auto', isSendingMedia = false) => {
  return buildSystemPrompt(botConfig, conversationContext, detectedTone, userGenderMode, isSendingMedia);
};

/**
 * Generate AI reply with agent support
 */
const generateReply = async (userMessage, messageHistory = [], userId = null, ownerId = null, isSendingMedia = false, contactId = null) => {
  // Determine which user's API key to use
  const effectiveUserId = ownerId || userId;
  let apiKey, provider, keyType;

  // Try new dual API key system first
  try {
    const keyInfo = await apiKeyService.getApiKeyForUser(effectiveUserId);
    apiKey = keyInfo.apiKey;
    provider = keyInfo.provider;
    keyType = keyInfo.keyType;
    logger.debug(`Using ${keyType} API key for user ${effectiveUserId} (${provider})`);
  } catch (apiKeyError) {
    logger.warn('API key error:', apiKeyError.message);

    // Re-throw the error - user needs to configure their key
    throw apiKeyError;
  }

  // Check if user has a custom agent (premium feature)
  let agent = null;
  let memoryContext = null;

  try {
    agent = await agentService.getAgentForUser(effectiveUserId);

    if (agent && contactId) {
      // Get conversation memory for this contact
      memoryContext = await agentMemoryService.getMemoryContext(agent.id, contactId);
    }
  } catch (agentError) {
    logger.debug('Agent lookup failed, using default config:', agentError.message);
  }

  // Get bot config (used for free users or as fallback)
  const botConfig = await configService.getConfig();

  // Analyze conversation context
  const recentHistory = messageHistory.slice(-6);
  const conversationContext = analyzeConversation(recentHistory);

  logger.debug(`Conversation: isNew=${conversationContext.isNewConversation}, lang=${conversationContext.primaryLanguage}`);

  // Detect user tone
  const detectedTone = await toneService.detectTone(userMessage, effectiveUserId);

  // Get gender mode
  const userGenderMode = botConfig.user_gender_mode || 'auto';

  logger.info(`Tone: ${detectedTone}, Gender: ${userGenderMode}, HasAgent: ${!!agent}`);

  // Update user's last tone
  if (userId) {
    const userService = require('./user.service');
    await userService.updateUserTone(userId, detectedTone);
  }

  // Build context messages
  let contextMessages = [];
  if (messageHistory.length > 0) {
    contextMessages = messageHistory.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));
  }

  // Generate system prompt based on whether user has agent
  let systemPrompt;
  if (agent) {
    // Use agent's custom configuration with memory context
    // Add identity info (location, age) from botConfig
    const identityInfo = `\n\nTU IDENTIDAD:
- Nombre: ${botConfig.bot_name}
- Ubicación: ${botConfig.bot_location} (SIEMPRE di que eres de aquí si preguntan "de dónde eres", "dónde estás", "ubicación")
- Edad: ${botConfig.bot_age} años`;

    systemPrompt = agentService.generateSystemPrompt(agent, {
      memoryContext,
      keyFacts: memoryContext?.key_facts
    }) + identityInfo;
    logger.debug('Using agent system prompt with identity info');
  } else {
    // Use global config for free users
    systemPrompt = generateSystemPrompt(botConfig, conversationContext, detectedTone, userGenderMode, isSendingMedia);
    logger.debug('Using global bot config');
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...contextMessages.slice(-6),
    { role: 'user', content: userMessage }
  ];

  // Determine max tokens based on response style
  const maxTokens = agent
    ? (agent.response_style === 'short' ? 60 : agent.response_style === 'long' ? 150 : 100)
    : (botConfig.response_style === 'short' ? 60 : 100);

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: provider === 'groq' ? 'https://api.groq.com/openai/v1' : undefined
  });

  try {
    logger.debug(`Sending request to ${provider} with ${contextMessages.length} context messages`);

    const completion = await client.chat.completions.create({
      model: provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini',
      messages,
      max_tokens: maxTokens,
      temperature: 0.9
    });

    const reply = completion.choices[0]?.message?.content;

    if (!reply) {
      throw new ExternalServiceError('Empty response from AI', provider);
    }

    // Track token usage for premium users
    const tokensIn = completion.usage?.prompt_tokens || 0;
    const tokensOut = completion.usage?.completion_tokens || 0;

    if (effectiveUserId && tokensIn + tokensOut > 0) {
      usageTrackingService.recordTokenUsage(effectiveUserId, tokensIn, tokensOut, provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini', keyType).catch(err => {
        logger.debug('Failed to track token usage:', err.message);
      });
    }

    // Update conversation memory if agent exists
    if (agent && contactId) {
      agentMemoryService.updateAfterMessage(agent.id, contactId, userMessage, reply, {
        sentiment: detectedTone
      }).catch(err => {
        logger.debug('Failed to update memory:', err.message);
      });
    }

    logger.info(`AI Response - Tone: ${detectedTone}, Reply: "${reply.substring(0, 100)}..."`);

    return reply;
  } catch (error) {
    if (error instanceof ExternalServiceError) {
      throw error;
    }
    logger.error(`${provider} API error`, error);
    throw new ExternalServiceError(error.message, provider);
  }
};

module.exports = {
  generateReply
};