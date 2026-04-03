const mediaService = require('./media.service');
const configService = require('./config.service');
const apiKeyService = require('./apiKey.service');
const prisma = require('../config/database');
const logger = require('../utils/logger');
const OpenAI = require('openai');

/**
 * Helper to get API key using the dual API key system
 */
const getApiKey = async (ownerId) => {
  try {
    const keyInfo = await apiKeyService.getApiKeyForUser(ownerId);
    return { apiKey: keyInfo.apiKey, provider: keyInfo.provider };
  } catch (error) {
    logger.warn('servicesMenu: No API key available:', error.message);
    return null;
  }
};

/**
 * Get available services from products table and config fallback
 * @param {string|null} ownerId
 * @returns {Promise<Array>}
 */
const getAvailableServices = async (ownerId = null) => {
  // Try to get products from database first
  const dbProducts = await prisma.product.findMany({
    where: {
      is_active: true,
      ...(ownerId ? { owner_user_id: parseInt(ownerId) } : {})
    },
    orderBy: { created_at: 'asc' }
  });

  // Get all active media
  const allMedia = await mediaService.getAllMedia({ ownerUserId: ownerId, isActive: true });

  // Build services list from DB products
  if (dbProducts.length > 0) {
    return dbProducts.map((product, index) => ({
      id: index + 1, // Display order (1, 2, 3...)
      productId: product.id, // Actual database ID
      name: product.name,
      description: product.description,
      price: product.price,
      type: 'product',
      hasMedia: allMedia.some(m => m.product_id === product.id)
    }));
  }

  // Fallback: Use products from config (string)
  const config = await configService.getConfig();
  const configProducts = config.products?.split(',').map(p => p.trim()).filter(Boolean) || [];

  // Build services list from config products
  const services = [];

  configProducts.forEach((product, index) => {
    const price = getServicePrice(product, config);
    services.push({
      id: index + 1,
      name: product,
      price: price,
      type: 'product',
      hasMedia: allMedia.some(m => m.keywords?.toLowerCase().includes(product.toLowerCase().split(' ')[0]))
    });
  });

  // If no products configured, use media categories
  if (services.length === 0 && allMedia.length > 0) {
    const uniqueKeywords = new Set();
    allMedia.forEach(m => {
      const keywords = m.keywords?.split(',').map(k => k.trim()) || [];
      keywords.forEach(k => {
        if (k) uniqueKeywords.add(k);
      });
    });

    Array.from(uniqueKeywords).slice(0, 5).forEach((keyword, index) => {
      const matchingMedia = allMedia.filter(m => m.keywords?.toLowerCase().includes(keyword.toLowerCase()));
      const avgPrice = matchingMedia.reduce((sum, m) => sum + (m.price || 0), 0) / matchingMedia.length;

      services.push({
        id: index + 1,
        name: capitalizeFirst(keyword),
        price: avgPrice > 0 ? avgPrice : null,
        type: 'media',
        hasMedia: true
      });
    });
  }

  return services;
};

/**
 * Generate natural services menu message using AI
 * @param {Array} services
 * @param {object} botConfig
 * @param {string|null} ownerId
 * @returns {Promise<string>}
 */
const generateServicesMenuMessage = async (services, botConfig, ownerId = null) => {
  try {
    // Get AI credentials
    const keyInfo = await getApiKey(ownerId);
    if (!keyInfo) {
      return generateFallbackMenuMessage(services, botConfig);
    }

    const botName = botConfig.bot_name || 'Shey';
    const botTone = botConfig.tone || 'playful';

    const servicesList = services.map((s, i) => {
      const priceText = s.price ? ` - $${s.price}` : '';
      return `${i + 1}. ${s.name}${priceText}`;
    }).join('\n');

    const systemPrompt = `Eres ${botName}, una chica real de Telegram que vende contenido. Un usuario te preguntó qué tienes/vendes.

Genera un mensaje NATURAL y CORTO (2-3 líneas máximo) que:
1. SaludE brevemente (como continuando la conversación, no como presentación formal)
2. Mencione que tienes estas opciones disponibles
3. Pregunte cuál le interesa

Servicios disponibles:
${servicesList}

Tono: ${botTone === 'serious' ? 'Profesional y formal, sin términos de cariño' : botTone === 'sexy' ? 'Coqueto y sugerente' : botTone === 'explicit' ? 'Directo y atrevido' : 'Amigable y juguetón'}

REGLAS:
- NUNCA digas "tengo las siguientes opciones" o "mis servicios son"
- Son natural, como si estuvieras chateando de verdad
- El mensaje debe invitar a seleccionar una opción
- Varía la forma de preguntar cada vez

Responde SOLO con el mensaje, nada más.`;

    const client = new OpenAI({
      apiKey: keyInfo.apiKey,
      baseURL: keyInfo.provider === 'groq' ? 'https://api.groq.com/openai/v1' : undefined
    });

    const completion = await client.chat.completions.create({
      model: keyInfo.provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Genera un mensaje para mostrar las opciones' }
      ],
      max_tokens: 100, // Reduced from 150
      temperature: 0.9
    });

    let message = completion.choices[0]?.message?.content?.trim() || '';

    // Append the options list
    message += '\n\n' + services.map((s, i) => {
      const priceText = s.price ? ` - $${s.price}` : '';
      return `${i + 1}. ${s.name}${priceText}`;
    }).join('\n');

    return message;
  } catch (error) {
    logger.error('Error generating menu message:', error);
    return generateFallbackMenuMessage(services, botConfig);
  }
};

/**
 * Fallback menu message
 */
const generateFallbackMenuMessage = (services, botConfig) => {
  const botName = botConfig.bot_name || 'Shey';

  const intros = [
    `Mira lo que tengo para ti ${botName === 'Shey' ? 'bb' : '💕'}`,
    `Aquí está lo que ofrezco ${botName === 'Shey' ? 'rico' : '🔥'}`,
    `Te cuento qué tengo disponible ${botName === 'Shey' ? '😏' : '💋'}`,
    `Mira las opciones ${botName === 'Shey' ? 'guapo' : '💖'}`,
    `Esto es lo que tengo ${botName === 'Shey' ? 'para ti' : '✨'}`
  ];

  const intro = intros[Math.floor(Math.random() * intros.length)];

  const servicesList = services.map((s, i) => {
    const priceText = s.price ? ` - $${s.price}` : '';
    return `${i + 1}. ${s.name}${priceText}`;
  }).join('\n');

  const closings = [
    '\n\n¿Cuál te interesa? 😏',
    '\n\n¿Cuál quieres ver? 💕',
    '\n\nDime cuál te gusta 💖',
    '\n\n¿Alguna te llama la atención? 🔥',
    '\n\nCuéntame cuál quieres 💋'
  ];

  const closing = closings[Math.floor(Math.random() * closings.length)];

  return `${intro}\n\n${servicesList}${closing}`;
};

/**
 * Generate confirmation message when user selects a service
 * @param {object} service
 * @param {object} botConfig
 * @param {string|null} ownerId
 * @returns {Promise<string>}
 */
const generateServiceConfirmationMessage = async (service, botConfig, ownerId = null) => {
  try {
    const keyInfo = await getApiKey(ownerId);
    if (!keyInfo) {
      return generateFallbackConfirmationMessage(service, botConfig);
    }

    const botName = botConfig.bot_name || 'Shey';
    const botTone = botConfig.tone || 'playful';

    const systemPrompt = `Eres ${botName}, una chica real de Telegram que vende contenido. El usuario seleccionó: "${service.name}".

Genera un mensaje CORTO (1-2 líneas) que:
1. Confirme su selección de forma natural
2. Mencione brevemente qué incluye o qué va a recibir
3. Genere expectativa

Tono: ${botTone === 'serious' ? 'Profesional' : botTone === 'sexy' ? 'Coqueto' : 'Juguetón'}

REGLAS:
- Son natural y breve
- NUNCA digas "has seleccionado" o "opción elegida"
- Habla como si fueras a enviarle algo especial

Responde SOLO con el mensaje.`;

    const client = new OpenAI({
      apiKey: keyInfo.apiKey,
      baseURL: keyInfo.provider === 'groq' ? 'https://api.groq.com/openai/v1' : undefined
    });

    const completion = await client.chat.completions.create({
      model: keyInfo.provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Genera un mensaje de confirmación' }
      ],
      max_tokens: 60,
      temperature: 0.9
    });

    return completion.choices[0]?.message?.content?.trim() || generateFallbackConfirmationMessage(service, botConfig);
  } catch (error) {
    logger.error('Error generating confirmation:', error);
    return generateFallbackConfirmationMessage(service, botConfig);
  }
};

/**
 * Fallback confirmation message
 */
const generateFallbackConfirmationMessage = (service, botConfig) => {
  const botName = botConfig.bot_name || 'Shey';

  const messages = [
    `¡Genial! ${service.name} ${botName === 'Shey' ? 'bb' : '😏'} Te mando algo...`,
    `¡Perfecto! ${service.name} es de mis favoritos 💕`,
    `¡Buenísima elección! Mira esto ${botName === 'Shey' ? 'rico' : '🔥'}`,
    `${service.name} 🔥 Aquí tienes algo especial`,
    `Te va a gustar esto ${botName === 'Shey' ? 'bb' : '💖'}`
  ];

  return messages[Math.floor(Math.random() * messages.length)];
};

/**
 * Get service by selection (number or name)
 * @param {Array} services
 * @param {string} selection
 * @returns {object|null}
 */
const getServiceBySelection = (services, selection) => {
  const sel = selection.toString().toLowerCase().trim();

  // Try by number
  const num = parseInt(sel);
  if (!isNaN(num) && num > 0 && num <= services.length) {
    return services[num - 1];
  }

  // Try exact name match first
  const exactMatch = services.find(s => s.name.toLowerCase() === sel);
  if (exactMatch) return exactMatch;

  // Try partial match (service name in selection)
  const partialMatch = services.find(s => {
    const serviceName = s.name.toLowerCase();
    // Check if selection contains the service name
    if (sel.includes(serviceName)) return true;
    // Check if service name contains the selection
    if (serviceName.includes(sel)) return true;
    return false;
  });
  if (partialMatch) return partialMatch;

  // Try word-by-word matching for multi-word messages
  // Extract individual words and check if any match a service
  const words = sel.split(/\s+/).filter(w => w.length > 2); // Ignore short words
  for (const word of words) {
    // Singularize/pluralize check
    const wordVariants = [
      word,
      word.replace(/s$/, ''),        // packs -> pack
      word + 's',                     // pack -> packs
      word.replace(/es$/, ''),        // fixes -> fix
      word + 'es'                     // fix -> fixes
    ];

    for (const variant of wordVariants) {
      const match = services.find(s => {
        const serviceName = s.name.toLowerCase();
        return serviceName === variant || serviceName.includes(variant) || variant.includes(serviceName);
      });
      if (match) return match;
    }
  }

  return null;
};

/**
 * Get price for a service from config
 */
const getServicePrice = (serviceName, config) => {
  // This could be expanded to read from a pricing config
  return null;
};

/**
 * Capitalize first letter
 */
const capitalizeFirst = (str) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Generate follow-up message after sending media content
 * @param {object} botConfig
 * @param {number} mediaCount - Number of media items sent
 * @param {string|null} ownerId
 * @returns {Promise<string>}
 */
const generateMediaFollowUpMessage = async (botConfig, mediaCount = 1, ownerId = null) => {
  try {
    const keyInfo = await getApiKey(ownerId);
    if (!keyInfo) {
      return generateFallbackFollowUpMessage(botConfig);
    }

    const botName = botConfig.bot_name || 'Shey';
    const botTone = botConfig.tone || 'playful';

    // Map tone to personality description
    const toneDescriptions = {
      'serious': 'Profesional y directo, sin emojis ni términos de cariño',
      'playful': 'Juguetón y coqueto, usa emojis y términos cariñosos',
      'sexy': 'Muy coqueto y sugerente, usa emojis y lenguaje provocativo',
      'explicit': 'Directo y atrevido, sin filtros'
    };

    const toneDesc = toneDescriptions[botTone] || toneDescriptions['playful'];

    const systemPrompt = `Eres ${botName}, una chica real de Telegram que vende contenido. Acabas de enviar ${mediaCount} ${mediaCount === 1 ? 'foto/video' : 'fotos/videos'} a un usuario que mostró interés en tu contenido.

Genera un mensaje CORTO (1-2 líneas máximo) que:
1. Pregunte cuál le gustó más o le llamó la atención
2. Invite a que te diga cuál quiere o le interesó más
3. Sea natural, como si estuvieras chateando de verdad

TONO: ${toneDesc}

REGLAS:
- NUNCA digas "he enviado", "aquí tienes" o "mira estas"
- Son natural, como continuación de una conversación
- Máximo 2 líneas
- Debe ser una pregunta que invite a interactuar
- Respeta el tono indicado

Responde SOLO con el mensaje, nada más.`;

    const client = new OpenAI({
      apiKey: keyInfo.apiKey,
      baseURL: keyInfo.provider === 'groq' ? 'https://api.groq.com/openai/v1' : undefined
    });

    const completion = await client.chat.completions.create({
      model: keyInfo.provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Genera el mensaje' }
      ],
      max_tokens: 60,
      temperature: 0.9
    });

    return completion.choices[0]?.message?.content?.trim() || generateFallbackFollowUpMessage(botConfig);
  } catch (error) {
    logger.error('Error generating follow-up:', error);
    return generateFallbackFollowUpMessage(botConfig);
  }
};

/**
 * Fallback follow-up message based on bot tone
 */
const generateFallbackFollowUpMessage = (botConfig) => {
  const botName = botConfig.bot_name || 'Shey';
  const botTone = botConfig.tone || 'playful';

  const toneMessages = {
    'serious': [
      `¿Cuál te interesa más?`,
      `¿Cuál opción prefieres?`,
      `Dime cuál te gusta`
    ],
    'playful': [
      `¿Cuál te llama más la atención? 😏`,
      `¿Cuál te gustó más? 💕`,
      `Dime cuál quieres ver 💖`,
      `¿Alguna te gustó más? 🔥`
    ],
    'sexy': [
      `¿Cuál te hace querer más? 😈`,
      `¿Cuál te calienta más? 🔥`,
      `Dime cuál quieres... 💋`,
      `¿Cuál te dejó con ganas? 😏`
    ],
    'explicit': [
      `¿Cuál quieres ver completo?`,
      `¿Cuál te pone más duro?`,
      `Dime cuál quieres y te lo mando`,
      `¿Cuál te hace terminar?`
    ]
  };

  const messages = toneMessages[botTone] || toneMessages['playful'];
  return messages[Math.floor(Math.random() * messages.length)];
};

/**
 * Generate message for invalid selection
 * @param {object} botConfig
 * @param {Array} services - Available services
 * @param {string|null} ownerId
 * @returns {Promise<string>}
 */
const generateInvalidSelectionMessage = async (botConfig, services, ownerId = null) => {
  try {
    const keyInfo = await getApiKey(ownerId);
    if (!keyInfo) {
      return generateFallbackInvalidSelectionMessage(services, botConfig);
    }

    const botName = botConfig.bot_name || 'Shey';
    const botTone = botConfig.tone || 'playful';

    const servicesList = services.map((s, i) => {
      const priceText = s.price ? ` - $${s.price}` : '';
      return `${i + 1}. ${s.name}${priceText}`;
    }).join('\n');

    const systemPrompt = `Eres ${botName}, una chica real de Telegram. El usuario está en medio de elegir un servicio pero envió algo que no es una opción válida.

Responde de forma NATURAL y CORTA (1-2 líneas) pidiendo que seleccione una de las opciones disponibles.

Opciones disponibles:
${servicesList}

Tono: ${botTone === 'serious' ? 'Profesional' : botTone === 'sexy' ? 'Coqueto' : 'Juguetón'}

REGLAS:
- No repitas el menú completo
- Solo menciona que necesita elegir una de las opciones (puedes listar los números disponibles)
- Son natural, como si estuvieras chateando de verdad
- No digas "opción inválida" o "selección incorrecta"

Responde SOLO con el mensaje.`;

    const client = new OpenAI({
      apiKey: keyInfo.apiKey,
      baseURL: keyInfo.provider === 'groq' ? 'https://api.groq.com/openai/v1' : undefined
    });

    const completion = await client.chat.completions.create({
      model: keyInfo.provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Genera un mensaje pidiendo que seleccione una opción válida' }
      ],
      max_tokens: 100,
      temperature: 0.9
    });

    return completion.choices[0]?.message?.content?.trim() || generateFallbackInvalidSelectionMessage(services, botConfig);
  } catch (error) {
    logger.error('Error generating invalid selection message:', error);
    return generateFallbackInvalidSelectionMessage(services, botConfig);
  }
};

/**
 * Fallback invalid selection message
 */
const generateFallbackInvalidSelectionMessage = (services, botConfig) => {
  const botName = botConfig.bot_name || 'Shey';
  const botTone = botConfig.tone || 'playful';

  const options = services.map((s, i) => `${i + 1}`).join(', ');

  const toneMessages = {
    'serious': [
      `Por favor selecciona una opción: ${options}`,
      `Necesito que elijas una opción (${options})`,
      `¿Cuál número quieres?`
    ],
    'playful': [
      `Solo necesito que me digas un número bb (${options}) 💕`,
      `Elige uno de estos: ${options} 😏`,
      `¿Cuál quieres? Solo dime el número (${options}) 💖`
    ],
    'sexy': [
      `Dime el número que quieres (${options}) 🔥`,
      `Solo necesito saber cuál quieres (${options}) 💋`,
      `¿Cuál te llama la atención? (${options}) 😈`
    ],
    'explicit': [
      `Dime cuál quieres y te lo mando (${options})`,
      `Solo necesito el número que quieres`,
      `Elige uno: ${options}`
    ]
  };

  const messages = toneMessages[botTone] || toneMessages['playful'];
  return messages[Math.floor(Math.random() * messages.length)];
};

/**
 * Generate a redirect message to bring conversation back to menu
 * @param {object} botConfig
 * @param {Array} services - Available services
 * @param {string|null} ownerId
 * @returns {Promise<string>}
 */
const generateMenuRedirectMessage = async (botConfig, services, ownerId = null) => {
  try {
    const keyInfo = await getApiKey(ownerId);
    if (!keyInfo) {
      return generateFallbackMenuRedirectMessage(services, botConfig);
    }

    const botName = botConfig.bot_name || 'Shey';
    const botTone = botConfig.tone || 'playful';

    const servicesList = services.map((s, i) => {
      const priceText = s.price ? ` - $${s.price}` : '';
      return `${i + 1}. ${s.name}${priceText}`;
    }).join('\n');

    const systemPrompt = `Eres ${botName}, una chica real de Telegram que vende contenido. Estabas conversando con un usuario y ahora quieres traer la conversación de vuelta a tus servicios/productos.

Genera un mensaje CORTO (1-2 líneas máximo) que:
1. Haga una transición natural desde cualquier tema
2. Mencione brevemente las opciones disponibles
3. Invite a elegir una

Servicios disponibles:
${servicesList}

Tono: ${botTone === 'serious' ? 'Profesional' : botTone === 'sexy' ? 'Coqueto' : 'Juguetón'}

REGLAS:
- Son natural, como cambiando de tema en una conversación real
- No digas "volviendo al tema" o "regresando a"
- Integra las opciones de forma sutil
- Máximo 2 líneas antes de la lista

Responde SOLO con el mensaje (la lista de opciones se agregará automáticamente).`;

    const client = new OpenAI({
      apiKey: keyInfo.apiKey,
      baseURL: keyInfo.provider === 'groq' ? 'https://api.groq.com/openai/v1' : undefined
    });

    const completion = await client.chat.completions.create({
      model: keyInfo.provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Genera un mensaje para redirigir a los servicios' }
      ],
      max_tokens: 100,
      temperature: 0.9
    });

    let message = completion.choices[0]?.message?.content?.trim() || generateFallbackMenuRedirectMessage(services, botConfig);

    // Append options list
    message += '\n\n' + services.map((s, i) => {
      const priceText = s.price ? ` - $${s.price}` : '';
      return `${i + 1}. ${s.name}${priceText}`;
    }).join('\n');

    return message;
  } catch (error) {
    logger.error('Error generating menu redirect:', error);
    return generateFallbackMenuRedirectMessage(services, botConfig);
  }
};

/**
 * Fallback menu redirect message
 */
const generateFallbackMenuRedirectMessage = (services, botConfig) => {
  const botName = botConfig.bot_name || 'Shey';
  const botTone = botConfig.tone || 'playful';

  const servicesList = services.map((s, i) => {
    const priceText = s.price ? ` - $${s.price}` : '';
    return `${i + 1}. ${s.name}${priceText}`;
  }).join('\n');

  const toneIntros = {
    'serious': [
      'Por el momento tengo disponibles:',
      'Las opciones son:',
      'Actualmente ofrezco:'
    ],
    'playful': [
      `Mira lo que tengo para ti:`,
      `Te cuento qué tengo disponible:`,
      `Aquí está lo que ofrezco:`
    ],
    'sexy': [
      `Mira qué tengo para ti:`,
      `Te muestro mis opciones:`,
      `Esto es lo que tengo:`
    ],
    'explicit': [
      `Mira mis opciones:`,
      `Tengo esto disponible:`,
      `Elige lo que quieres:`
    ]
  };

  const intros = toneIntros[botTone] || toneIntros['playful'];
  const intro = intros[Math.floor(Math.random() * intros.length)];

  return `${intro}\n\n${servicesList}`;
};

/**
 * Generate response when user expresses interest in content
 * Naturally mentions payment methods without sounding templated
 * @param {object} botConfig
 * @param {string|null} ownerId
 * @returns {Promise<string>}
 */
const generateInterestResponse = async (botConfig, ownerId = null) => {
  try {
    const keyInfo = await getApiKey(ownerId);
    if (!keyInfo) {
      return generateFallbackInterestResponse(botConfig);
    }

    const botName = botConfig.bot_name || 'Shey';
    const botTone = botConfig.tone || 'playful';

    // Get available payment methods
    const paymentMethods = await getAvailablePaymentMethods(ownerId);
    const paymentInfo = formatPaymentMethods(paymentMethods, botConfig);

    const systemPrompt = `Eres ${botName}, una chica real de Telegram que vende contenido. El usuario acaba de ver tu contenido y expresó interés.

Genera un mensaje NATURAL y CORTO (2-3 líneas máximo) que:
1. Muestre entusiasmo por su interés
2. Mencione NATURALMENTE las formas de pago disponibles (NO como lista, sino integrado en la conversación)
3. Pregunte cuál prefiere o si tiene alguna duda

Formas de pago disponibles: ${paymentInfo}

Tono: ${botTone === 'serious' ? 'Profesional y cercano' : botTone === 'sexy' ? 'Coqueto y sugerente' : botTone === 'explicit' ? 'Directo y atrevido' : 'Amigable y juguetón'}

REGLAS IMPORTANTES:
- NO digas "tengo los siguientes métodos de pago" o frases similares de lista
- Integra las formas de pago de forma natural en la conversación
- NO uses formato de lista con viñetas o números para los pagos
- Menciona máximo 2 formas de pago en el mensaje
- El mensaje debe sonar como si estuvieras chateando, no como un vendedor
- Puede usar emojis apropiados según el tono

Responde SOLO con el mensaje, nada más.`;

    const client = new OpenAI({
      apiKey: keyInfo.apiKey,
      baseURL: keyInfo.provider === 'groq' ? 'https://api.groq.com/openai/v1' : undefined
    });

    const completion = await client.chat.completions.create({
      model: keyInfo.provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'El usuario dijo que le interesa el contenido' }
      ],
      max_tokens: 150,
      temperature: 0.9
    });

    return completion.choices[0]?.message?.content?.trim() || generateFallbackInterestResponse(botConfig);
  } catch (error) {
    logger.error('Error generating interest response:', error);
    return generateFallbackInterestResponse(botConfig);
  }
};

/**
 * Fallback interest response
 */
const generateFallbackInterestResponse = (botConfig) => {
  const botName = botConfig.bot_name || 'Shey';
  const botTone = botConfig.tone || 'playful';

  const toneResponses = {
    'serious': [
      `¡Qué bueno que te interese! Puedes pagar por transferencia o PayPal. ¿Cuál prefieres?`,
      `Me alegra tu interés. Acepto transferencia y PayPal, ¿cuál te va mejor?`,
      `Perfecto. Para continuar necesito el pago, puedes usar transferencia o PayPal.`
    ],
    'playful': [
      `¡Me encanta que te guste! 💕 Puedes pagarme por transferencia o PayPal, ¿cuál te va mejor bb?`,
      `¡Qué bien! 😊 Te paso mis datos: acepto transferencia y PayPal, ¿con cuál te quedas?`,
      `¡Genial! 💖 Para que sea tuyo necesito el pago, ¿prefieres transferencia o PayPal?`
    ],
    'sexy': [
      `¡Me encanta que te guste! 🔥 Puedes pagarme por transferencia o PayPal, ¿cuál prefieres?`,
      `Mmm, ¡qué bien! 💋 Acepto transferencia y PayPal, ¿cuál te funciona mejor?`,
      `¡Excelente elección! 😈 Para que sea tuyo necesito el pago... ¿transferencia o PayPal?`
    ],
    'explicit': [
      `¡Perfecto! Acepto transferencia y PayPal. ¿Con cuál me vas a pagar?`,
      `Para que sea tuyo necesito el pago. ¿Transferencia o PayPal?`,
      `¡Excelente! ¿Cómo prefieres pagar? Tengo transferencia y PayPal.`
    ]
  };

  const responses = toneResponses[botTone] || toneResponses['playful'];
  return responses[Math.floor(Math.random() * responses.length)];
};

/**
 * Get available payment methods from database or config
 */
const getAvailablePaymentMethods = async (ownerId) => {
  try {
    const prisma = require('../config/database');

    // Get payment methods from database (filtered by bot_config_id = 1 for default config)
    const methods = await prisma.paymentMethodConfig.findMany({
      where: {
        bot_config_id: 1,
        is_active: true
      },
      orderBy: { display_order: 'asc' }
    });

    if (methods.length > 0) {
      return methods.map(m => m.method_type);
    }

    // Fallback to default methods
    return ['transferencia', 'PayPal'];
  } catch (error) {
    logger.error('Error getting payment methods:', error);
    return ['transferencia', 'PayPal'];
  }
};

/**
 * Format payment methods for prompt
 */
const formatPaymentMethods = async (methods, botConfig) => {
  // Get specific payment info from config if available
  const sinpeNumber = botConfig.sinpe_number;
  const paypalLink = botConfig.paypal_link;

  const formatted = [];
  for (const method of methods) {
    if (method.toLowerCase().includes('sinpe') || method.toLowerCase().includes('transfer')) {
      formatted.push(sinpeNumber ? `SINPE móvil al ${sinpeNumber}` : 'transferencia');
    } else if (method.toLowerCase().includes('paypal')) {
      formatted.push('PayPal');
    } else {
      formatted.push(method);
    }
  }

  return formatted.join(' o ');
};

/**
 * Generate a personalized recommendation for a service
 * @param {Array} services - Available services
 * @param {object} botConfig - Bot configuration
 * @param {string|null} ownerId - Owner ID
 * @returns {Promise<string>}
 */
const generateRecommendationResponse = async (services, botConfig, ownerId = null) => {
  try {
    // Get AI credentials
    const keyInfo = await getApiKey(ownerId);
    if (!keyInfo) {
      return generateFallbackRecommendationResponse(services, botConfig);
    }

    const botName = botConfig.bot_name || 'Shey';
    const botTone = botConfig.tone || 'playful';

    // Separate services with and without descriptions
    const servicesWithDesc = services.filter(s => s.description && s.description.trim());
    const servicesWithoutDesc = services.filter(s => !s.description || !s.description.trim());

    // Build services info for AI - include descriptions when available
    let servicesInfo;
    let hasDescriptions = servicesWithDesc.length > 0;

    if (servicesWithDesc.length === services.length) {
      // All services have descriptions - provide full info
      servicesInfo = services.map((s, i) => {
        const priceText = s.price ? ` ($${s.price})` : '';
        return `${i + 1}. ${s.name}${priceText}\n   ${s.description}`;
      }).join('\n\n');
    } else if (servicesWithDesc.length > 0) {
      // Some services have descriptions - mark which have details
      servicesInfo = services.map((s, i) => {
        const priceText = s.price ? ` ($${s.price})` : '';
        const descText = s.description ? `\n   ${s.description}` : ' (sin descripción detallada)';
        return `${i + 1}. ${s.name}${priceText}${descText}`;
      }).join('\n\n');
    } else {
      // No descriptions - just names and prices
      servicesInfo = services.map((s, i) => {
        const priceText = s.price ? ` - $${s.price}` : '';
        return `${i + 1}. ${s.name}${priceText}`;
      }).join('\n');
    }

    // Build different prompts based on available information
    let systemPrompt;

    if (hasDescriptions) {
      // We have descriptions - analyze them to make smart recommendation
      systemPrompt = `Eres ${botName}, una chica real de Telegram que vende contenido. El usuario te preguntó qué le recomiendas.

Tienes estos productos con sus descripciones:
${servicesInfo}

${servicesWithDesc.length === services.length
  ? 'ANÁLISIS: Lee cuidadosamente cada descripción y elige el producto MÁS ATRACTIVO y COMPLETO para recomendar.'
  : 'ANÁLISIS: Algunos productos tienen descripción detallada. Elige el más atractivo basándote en la información disponible.'}

Genera un mensaje NATURAL y CORTO (2-3 líneas máximo) que:
1. Recomiende UNA opción específica de forma convincente y personal
2. Menciona detalles específicos de la descripción del producto elegido
3. Explica POR QUÉ es la mejor opción para el usuario
4. Termina con una pregunta o invitación a actuar

Tono: ${botTone === 'serious' ? 'Profesional y directo' : botTone === 'sexy' ? 'Coqueto y sugerente' : botTone === 'explicit' ? 'Directo y atrevido' : 'Amigable y entusiasta'}

REGLAS:
- NUNCA digas "te recomiendo la opción X" o "mi recomendación es"
- Usa información REAL de las descripciones para convencer
- Habla de forma natural, como si conoces bien tus productos
- Si mencionas precio, hazlo sonar como una oportunidad
- Sé convincente pero no insistente

Responde SOLO con el mensaje, nada más.`;
    } else {
      // No descriptions - make a general but intelligent suggestion
      systemPrompt = `Eres ${botName}, una chica real de Telegram que vende contenido. El usuario te preguntó qué le recomiendas.

Tienes estos productos:
${servicesInfo}

No tienes descripciones detalladas, pero conoces bien tus productos y sabes qué ofrecer.

Genera un mensaje NATURAL y CORTO (2-3 líneas máximo) que:
1. Sugiere UNA opción de forma inteligente (puedes basarte en el precio más alto o mencionar que es el más popular)
2. Haz que suene atractivo aunque no tengas detalles específicos
3. Invita al usuario a preguntar más sobre el que le interese
4. Termina con una pregunta para continuar la conversación

Tono: ${botTone === 'serious' ? 'Profesional y directo' : botTone === 'sexy' ? 'Coqueto y sugerente' : botTone === 'explicit' ? 'Directo y atrevido' : 'Amigable y entusiasta'}

REGLAS:
- NUNCA digas "no tengo descripciones" o "no sé"
- Habla con seguridad sobre tus productos
- Sugiere de forma natural sin sonar como vendedor
- Puedes preguntar qué tipo de contenido le gusta para orientarlo mejor
- Mantén la conversación fluida

Responde SOLO con el mensaje, nada más.`;
    }

    const client = new OpenAI({
      apiKey: keyInfo.apiKey,
      baseURL: keyInfo.provider === 'groq' ? 'https://api.groq.com/openai/v1' : undefined
    });

    const completion = await client.chat.completions.create({
      model: keyInfo.provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: '¿Cuál me recomiendas?' }
      ],
      max_tokens: 100, // Reduced from 200
      temperature: 0.9
    });

    return completion.choices[0]?.message?.content?.trim() || generateFallbackRecommendationResponse(services, botConfig);
  } catch (error) {
    logger.error('Error generating recommendation:', error);
    return generateFallbackRecommendationResponse(services, botConfig);
  }
};

/**
 * Fallback recommendation response (used when AI is not available)
 */
const generateFallbackRecommendationResponse = (services, botConfig) => {
  const botName = botConfig.bot_name || 'Shey';
  const botTone = botConfig.tone || 'playful';

  // Separate services with and without descriptions
  const servicesWithDesc = services.filter(s => s.description && s.description.trim());

  // Smart selection: prefer services with description, then media, then highest price
  let recommended;

  if (servicesWithDesc.length > 0) {
    // Pick from services with description (prefer highest price among them)
    recommended = servicesWithDesc.reduce((best, current) => {
      if (!best) return current;
      if (current.price && (!best.price || current.price > best.price)) return current;
      if (current.hasMedia && !best.hasMedia) return current;
      return best;
    }, null);
  }

  if (!recommended) {
    // Fallback: pick by media or price
    recommended = services[0];
    for (const s of services) {
      if (s.hasMedia) {
        recommended = s;
        break;
      }
      if (s.price && (!recommended.price || s.price > recommended.price)) {
        recommended = s;
      }
    }
  }

  const priceText = recommended.price ? ` por solo $${recommended.price}` : '';

  // If we have description, use it in the response
  if (recommended.description) {
    // Extract key benefits from description (first line or key points)
    const descPreview = recommended.description.split('\n')[0].substring(0, 80);

    const toneResponses = {
      'serious': [
        `Te recomiendo ${recommended.name}${priceText}. ${descPreview} Es la opción más completa.`,
        `${recommended.name} es ideal${priceText}. ${descPreview}`
      ],
      'playful': [
        `¡Te recomiendo ${recommended.name}! 💕${priceText} ${descPreview} ¿Qué te parece?`,
        `¡${recommended.name} es increíble! ${priceText ? `Por ${recommended.price}` : 'Es mi favorito'} 💖 ${descPreview}`
      ],
      'sexy': [
        `¡${recommended.name} sin duda! 🔥${priceText} ${descPreview} Te va a encantar...`,
        `Mmm, ${recommended.name} es mi favorito 😈${priceText} ${descPreview}`
      ],
      'explicit': [
        `¡${recommended.name}!${priceText} ${descPreview} Sin límites.`,
        `${recommended.name} es el más pedido${priceText}. ${descPreview}`
      ]
    };

    const responses = toneResponses[botTone] || toneResponses['playful'];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // No description - general response
  const toneResponses = {
    'serious': [
      `Te recomiendo ${recommended.name}${priceText}. Es una de las opciones más completas y populares.`,
      `${recommended.name} es excelente valor${priceText}. Incluye contenido exclusivo de alta calidad.`,
      `La opción ${recommended.name} es muy popular${priceText}. Tendrás acceso a todo el contenido premium.`
    ],
    'playful': [
      `¡Mmm, te recomiendo ${recommended.name}! 💕${priceText} Es mi favorito y tiene todo lo que te va a gustar ${botName === 'Shey' ? 'bb' : '🔥'}`,
      `¡Definitivamente ${recommended.name}! ${priceText ? `Por ${recommended.price} es una ganga` : 'Es súper completo'} 💖 ¿Qué dices?`,
      `Te digo que ${recommended.name} es increíble ${botName === 'Shey' ? 'mi amor' : '😏'}${priceText}. Tiene todo lo que buscas y más...`
    ],
    'sexy': [
      `¡${recommended.name} sin duda! 🔥${priceText} Es el que más contenido exclusivo tiene... vas a disfrutar mucho 💋`,
      `Te recomiendo ${recommended.name} ${botName === 'Shey' ? 'guapo' : '🔥'}${priceText}. Es mi preferido y sé que te va a encantar...`,
      `Mmm, ${recommended.name} es mi favorito 😈${priceText}. Tiene todo lo que necesitas para pasarla bien...`
    ],
    'explicit': [
      `¡${recommended.name}! ${priceText ? `Por ${recommended.price} tienes acceso completo` : 'Es la opción más completa'}. Sin límites.`,
      `Te recomiendo ${recommended.name}${priceText}. Es el más pedido y tiene todo el contenido sin restricciones.`,
      `¡Vamos con ${recommended.name}!${priceText} Es el más completo y los clientes quedan súper satisfechos.`
    ]
  };

  const responses = toneResponses[botTone] || toneResponses['playful'];
  return responses[Math.floor(Math.random() * responses.length)];
};

module.exports = {
  getAvailableServices,
  generateServicesMenuMessage,
  generateServiceConfirmationMessage,
  getServiceBySelection,
  generateMediaFollowUpMessage,
  generateInvalidSelectionMessage,
  generateMenuRedirectMessage,
  generateInterestResponse,
  generateRecommendationResponse
};