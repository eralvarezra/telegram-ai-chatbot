const OpenAI = require('openai');
const setupService = require('./setup.service');
const userCredentialsService = require('./userCredentials.service');
const logger = require('../utils/logger');

/**
 * Intent types for message classification
 */
const INTENT_TYPES = {
  BROWSE_CONTENT: 'browse_content',
  BUY: 'buy',
  INTEREST: 'interest',  // User expressed interest in content
  CASUAL_CHAT: 'casual_chat',
  PRICE_INQUIRY: 'price_inquiry',
  PAYMENT_METHOD: 'payment_method',
  SERVICE_SELECTION: 'service_selection',
  RECOMMENDATION: 'recommendation',  // User asking for recommendation
  OTHER: 'other'
};

/**
 * Classify user intent using AI
 * @param {string} userMessage - The user's message
 * @param {string|null} ownerId - Owner ID for credentials
 * @returns {Promise<{intent: string, confidence: number, reasoning: string}>}
 */
const classifyIntent = async (userMessage, ownerId = null) => {
  try {
    // Get AI credentials
    let aiCreds = null;

    if (ownerId) {
      aiCreds = await userCredentialsService.getAICredentials(ownerId);
    }

    if (!aiCreds || !aiCreds.apiKey) {
      aiCreds = await setupService.getAICredentials();
    }

    if (!aiCreds || !aiCreds.apiKey) {
      logger.warn('No AI credentials for intent classification, using fallback');
      return classifyIntentFallback(userMessage);
    }

    const systemPrompt = `You are an intent classifier for a Telegram bot that sells adult content.

Analyze the user's message and classify their intent into EXACTLY ONE of these categories:

1. **browse_content** - User wants to see available content, packs, options, or variety
   Examples: "qué tienes", "what do you have", "muéstrame", "show me", "qué packs hay", "what options", "qué vendes", "qué contenido tienes", "enséñame", "let me see", "what's available", "tienes algo", "qué hay", "qué servicios ofreces"

2. **service_selection** - User is selecting a specific service/option from a list (number, name, or description)
   Examples: "opción 1", "option 2", "la primera", "the second one", "quiero el pack de fotos", "I want the video pack", "el de sexting", "dame el premium", "el número 3", "me interesa el pack"

3. **interest** - User expressed interest in content they just saw, wants to see more, or is considering purchase
   Examples: "me gustó", "I like it", "me interesa", "este está bien", "quiero ver más", "I want to see more", "me gustaría este", "I'd like this one", "cuéntame más", "tell me more", "cómo funciona", "how does it work", "quiero ver como funciona", "está bueno", "nice", "qué incluye", "what's included"

4. **recommendation** - User is asking for a recommendation or advice on which option to choose
   Examples: "cuál me recomiendas", "which one do you recommend", "qué me sugieres", "what do you suggest", "cuál está mejor", "which is better", "cuál me conviene", "cuál es el mejor", "qué eligirías", "what would you choose", "ayúdame a elegir", "help me choose", "no sé cuál elegir", "I don't know which to pick", "cuál es tu favorito", "which is your favorite", "recomiéndame algo", "recommend me something"

5. **buy** - User is ready to purchase or explicitly wants to buy now
   Examples: "quiero comprar", "I want to buy", "dame el pack", "I'll take it", "lo compro", "how do I get it", "quisiera comprarlo", "estoy listo para comprar"

6. **price_inquiry** - User is asking about prices
   Examples: "cuánto cuesta", "how much", "precio", "price", "cuánto es", "cost", "cuánto cobras"

7. **payment_method** - User is asking how to pay
   Examples: "cómo pago", "how do I pay", "métodos de pago", "payment methods", "PayPal", "SINPE", "transferencia", "how to send money"

8. **casual_chat** - General conversation, greeting, or friendly chat
   Examples: "hola", "hello", "how are you", "qué tal", "buen día", "hey", "hi", "what's up"

9. **other** - Doesn't fit any category above

Respond with ONLY a JSON object (no markdown, no explanation):
{"intent": "category_name", "confidence": 0.95, "reasoning": "brief reason", "selected_option": "number or name if service_selection"}

Confidence should be between 0 and 1.
Reasoning should be very brief (max 10 words).
selected_option should be the number or name the user selected (only for service_selection intent).`;

    const client = new OpenAI({
      apiKey: aiCreds.apiKey,
      baseURL: aiCreds.provider === 'groq' ? 'https://api.groq.com/openai/v1' : undefined
    });

    const completion = await client.chat.completions.create({
      model: aiCreds.provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 60, // Reduced from 100
      temperature: 0.3 // Lower temperature for more consistent classification
    });

    const response = completion.choices[0]?.message?.content?.trim();

    if (!response) {
      return classifyIntentFallback(userMessage);
    }

    // Parse the JSON response
    try {
      // Remove any markdown formatting
      const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanResponse);

      // Validate the intent
      const validIntents = Object.values(INTENT_TYPES);
      if (!validIntents.includes(parsed.intent)) {
        parsed.intent = INTENT_TYPES.OTHER;
      }

      logger.debug(`Intent classified: ${parsed.intent} (confidence: ${parsed.confidence}) for message: "${userMessage.substring(0, 50)}..."`);

      return {
        intent: parsed.intent,
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || '',
        selected_option: parsed.selected_option || null
      };
    } catch (parseError) {
      logger.warn('Failed to parse intent classification response:', response);
      return classifyIntentFallback(userMessage);
    }
  } catch (error) {
    logger.error('Error classifying intent:', error);
    return classifyIntentFallback(userMessage);
  }
};

/**
 * Fallback intent classification using keyword matching
 * @param {string} userMessage
 * @returns {{intent: string, confidence: number, reasoning: string, selected_option: string|null}}
 */
const classifyIntentFallback = (userMessage) => {
  const msg = userMessage.toLowerCase().trim();

  // Service selection patterns - check this FIRST
  const selectionPatterns = [
    /^opción\s*(\d+)/i, /^option\s*(\d+)/i,
    /^la\s*(\d+)/i, /^el\s*(\d+)/i,
    /^número\s*(\d+)/i, /^numero\s*(\d+)/i,
    /^numero\s*(\d+)/i, /^number\s*(\d+)/i,
    /^(\d+)$/, // Just a number
    /^primera?$/i, /^segunda?$/i, /^tercera?$/i, /^cuarta?$/i, /^quinta?$/i,
    /^first$/i, /^second$/i, /^third$/i, /^fourth$/i, /^fifth$/i,
    /^la\s*primera?$/i, /^el\s*primero?$/i,
    /^la\s*segunda?$/i, /^el\s*segundo?$/i,
    /^la\s*tercera?$/i, /^el\s*tercero?$/i,
    /quiero\s*el\s*(\d+)/i, /dame\s*el\s*(\d+)/i,
    /quisiera\s*el\s*(\d+)/i, /me\s*interesa\s*el\s*(\d+)/i,
    /quiero\s*la\s*(\d+)/i, /dame\s*la\s*(\d+)/i,
    /selecciono\s*la?\s*(\d+)/i, /selección\s*(\d+)/i
  ];

  for (const pattern of selectionPatterns) {
    const match = msg.match(pattern);
    if (match) {
      // Extract the option number or name
      let selectedOption = match[1] || match[0];

      // Convert word numbers to digits
      const wordNumbers = {
        'primera': '1', 'primero': '1', 'first': '1',
        'segunda': '2', 'segundo': '2', 'second': '2',
        'tercera': '3', 'tercero': '3', 'third': '3',
        'cuarta': '4', 'cuarto': '4', 'fourth': '4',
        'quinta': '5', 'quinto': '5', 'fifth': '5'
      };

      if (wordNumbers[selectedOption.toLowerCase()]) {
        selectedOption = wordNumbers[selectedOption.toLowerCase()];
      }

      return {
        intent: INTENT_TYPES.SERVICE_SELECTION,
        confidence: 0.9,
        reasoning: 'User selected an option',
        selected_option: selectedOption
      };
    }
  }

  // Check for service names
  const serviceKeywords = ['pack', 'video', 'foto', 'photos', 'fotos', 'videos', 'sexting', 'llamada', 'call', 'premium', 'exclusivo', 'vip', 'canal'];
  const selectionWords = ['quiero', 'dame', 'quisiera', 'me interesa', 'elijo', 'selecciono', 'info', 'información', 'informacion', 'ver', 'muéstrame', 'muestrame'];

  for (const word of selectionWords) {
    if (msg.includes(word)) {
      for (const keyword of serviceKeywords) {
        // Check both singular and plural forms
        const keywordVariants = [
          keyword,
          keyword + 's',           // pack -> packs
          keyword.replace(/s$/, '') // packs -> pack
        ];
        for (const variant of keywordVariants) {
          if (msg.includes(variant)) {
            return {
              intent: INTENT_TYPES.SERVICE_SELECTION,
              confidence: 0.85,
              reasoning: 'User selected a service',
              selected_option: keyword
            };
          }
        }
      }
    }
  }

  // Also check for direct keyword mentions with context words
  const contextWords = ['el', 'la', 'los', 'las', 'un', 'una', 'del', 'de', 'sobre'];
  for (const keyword of serviceKeywords) {
    const keywordVariants = [keyword, keyword + 's', keyword.replace(/s$/, '')];
    for (const variant of keywordVariants) {
      if (msg.includes(variant)) {
        // Check if there's context indicating selection
        const hasSelectionContext = selectionWords.some(w => msg.includes(w)) ||
                                    contextWords.some(w => msg.includes(w + ' ' + variant)) ||
                                    msg.includes(variant + ' ');
        if (hasSelectionContext) {
          return {
            intent: INTENT_TYPES.SERVICE_SELECTION,
            confidence: 0.8,
            reasoning: 'User mentioned a service with context',
            selected_option: keyword
          };
        }
      }
    }
  }

  // Browse content patterns
  const browsePatterns = [
    'qué tienes', 'que tienes', 'what do you have', 'what you got',
    'muéstrame', 'muestrame', 'show me', 'show me what',
    'qué packs', 'que packs', 'what packs', 'what options',
    'qué vendes', 'que vendes', 'what do you sell', 'what you sell',
    'qué contenido', 'que contenido', 'what content',
    'enséñame', 'enseñame', 'teach me', 'let me see',
    'qué hay', 'que hay', 'what is there', 'what\'s available',
    'tienes algo', 'do you have something', 'do you have any',
    'qué ofreces', 'que ofreces', 'what do you offer', 'what you offer',
    'opciones', 'options', 'variedad', 'variety',
    'qué tienes disponible', 'what do you have available',
    'qué me puedes', 'what can you', 'dame opciones', 'give me options',
    'ver todo', 'see all', 'ver todo lo que tienes',
    'qué servicios', 'what services', 'servicios'
  ];

  // Check browse content
  for (const pattern of browsePatterns) {
    if (msg.includes(pattern)) {
      return {
        intent: INTENT_TYPES.BROWSE_CONTENT,
        confidence: 0.85,
        reasoning: 'Keyword match for browse_content',
        selected_option: null
      };
    }
  }

  // Buy patterns
  const buyPatterns = [
    'quiero comprar', 'i want to buy', 'I want to purchase',
    'dame el pack', 'give me the pack', 'I\'ll take it',
    'lo quiero', 'I want it', 'quisiera el pack',
    'compro', 'I buy', 'me lo llev', 'I\'ll get',
    'estoy listo', 'I\'m ready', 'ready to buy',
    'hacemos negocio', 'let\'s do business', 'cerramos trato'
  ];

  for (const pattern of buyPatterns) {
    if (msg.includes(pattern)) {
      return {
        intent: INTENT_TYPES.BUY,
        confidence: 0.85,
        reasoning: 'Keyword match for buy',
        selected_option: null
      };
    }
  }

  // Price patterns
  const pricePatterns = [
    'cuánto cuesta', 'cuanto cuesta', 'how much',
    'precio', 'price', 'cuánto es', 'cuanto es',
    'cost', 'cuánto cobras', 'cuanto cobras',
    'cuánto vale', 'cuanto vale', 'how much does it cost',
    'tarifa', 'rate', 'fee'
  ];

  for (const pattern of pricePatterns) {
    if (msg.includes(pattern)) {
      return {
        intent: INTENT_TYPES.PRICE_INQUIRY,
        confidence: 0.85,
        reasoning: 'Keyword match for price_inquiry',
        selected_option: null
      };
    }
  }

  // Payment patterns
  const paymentPatterns = [
    'cómo pago', 'como pago', 'how do I pay',
    'métodos de pago', 'payment methods', 'payment method',
    'paypay', 'sinpe', 'transferencia', 'transfer',
    'cómo pago', 'how to pay', 'how can I pay',
    'dónde deposito', 'where do I deposit', 'cómo envío dinero'
  ];

  for (const pattern of paymentPatterns) {
    if (msg.includes(pattern)) {
      return {
        intent: INTENT_TYPES.PAYMENT_METHOD,
        confidence: 0.85,
        reasoning: 'Keyword match for payment_method',
        selected_option: null
      };
    }
  }

  // Interest patterns - user likes content or wants more info
  const interestPatterns = [
    'me gustó', 'me gusto', 'me gustaria', 'me gustaría', 'i like it', 'i like',
    'me interesa', 'me interesa este', 'interesado', 'interested',
    'este está bien', 'este esta bien', 'está bueno', 'esta bueno', 'nice', 'cool',
    'quiero ver más', 'quiero ver mas', 'ver más', 'ver mas', 'más de este',
    'cuéntame más', 'cuentame mas', 'tell me more', 'más información',
    'cómo funciona', 'como funciona', 'how does it work', 'how it works',
    'qué incluye', 'que incluye', 'what\'s included', 'what is included',
    'quiero saber más', 'quisiera saber', 'información', 'info de',
    'me parece bien', 'está padre', 'está chido', 'está genial',
    'qué tal está', 'que tal está', 'how is it', 'cómo es', 'como es',
    'quiero ver como funciona', 'quisiera ver', 'enséñame más', 'muestrame más'
  ];

  for (const pattern of interestPatterns) {
    if (msg.includes(pattern)) {
      return {
        intent: INTENT_TYPES.INTEREST,
        confidence: 0.85,
        reasoning: 'User expressed interest in content',
        selected_option: null
      };
    }
  }

  // Recommendation patterns - user asking for advice
  const recommendationPatterns = [
    'cuál me recomiendas', 'cual me recomiendas', 'which one do you recommend',
    'qué me sugieres', 'que me sugieres', 'what do you suggest',
    'cuál está mejor', 'cual está mejor', 'which is better',
    'cuál me conviene', 'cual me conviene', 'cuál es el mejor', 'cual es el mejor',
    'qué eligirías', 'que eligirías', 'what would you choose',
    'ayúdame a elegir', 'ayudame a elegir', 'help me choose',
    'no sé cuál elegir', 'no se cual elegir', 'no sé cual', 'I don\'t know which',
    'cuál es tu favorito', 'cual es tu favorito', 'which is your favorite',
    'recomiéndame', 'recomiendame', 'recommend me',
    'qué me aconsejas', 'que me aconsejas', 'what do you advise',
    'cuál elegir', 'cual elegir', 'which to choose',
    'mejor opción', 'mejor opcion', 'best option',
    'opinas', 'think', 'crees que', 'do you think'
  ];

  for (const pattern of recommendationPatterns) {
    if (msg.includes(pattern)) {
      return {
        intent: INTENT_TYPES.RECOMMENDATION,
        confidence: 0.85,
        reasoning: 'User asking for recommendation',
        selected_option: null
      };
    }
  }

  // Buy intent patterns - user ready to purchase (stronger signals)
  const buyIntentPatterns = [
    'quiero comprar', 'i want to buy', 'quisiera comprar',
    'lo compro', 'I\'ll take it', 'me lo llevo',
    'lo quiero', 'I want it', 'lo voy a comprar',
    'dame el', 'dame la', 'give me the',
    'quiero proceder', 'i want to proceed',
    'estoy listo para comprar', 'ready to buy',
    'cerramos', 'hacemos negocio', 'let\'s do it',
    'vale me quedo', 'ok me quedo', ' perfecto lo quiero'
  ];

  for (const pattern of buyIntentPatterns) {
    if (msg.includes(pattern)) {
      return {
        intent: INTENT_TYPES.BUY,
        confidence: 0.9,
        reasoning: 'User ready to purchase',
        selected_option: null
      };
    }
  }

  // Default to casual_chat
  return {
    intent: INTENT_TYPES.CASUAL_CHAT,
    confidence: 0.5,
    reasoning: 'No specific intent detected, defaulting to casual_chat',
    selected_option: null
  };
};

/**
 * Check if intent should trigger bulk media response
 * @param {string} intent
 * @param {number} confidence
 * @returns {boolean}
 */
const shouldSendBulkMedia = (intent, confidence = 1) => {
  return intent === INTENT_TYPES.BROWSE_CONTENT && confidence >= 0.6;
};

module.exports = {
  classifyIntent,
  classifyIntentFallback,
  shouldSendBulkMedia,
  INTENT_TYPES
};