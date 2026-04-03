const prisma = require('../config/database');
const logger = require('../utils/logger');

// Default personality configurations
const DEFAULT_PERSONALITY = {
  traits: ['friendly', 'helpful', 'attentive'],
  style: 'Natural y auténtica en las conversaciones. Responde de forma breve y directa.',
  tone: 'playful'
};

const TONE_CONFIGS = {
  serious: {
    description: 'Profesional, formal, serio',
    terms: {
      female: { es: ['señora', 'usted'], en: ["ma'am", 'you'] },
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
  },
  professional: {
    description: 'Profesional, servicial, claro',
    terms: {
      female: { es: ['señora', 'usted'], en: ["ma'am", 'you'] },
      male: { es: ['señor', 'usted'], en: ['sir', 'you'] },
      auto: { es: ['usted'], en: ['you'] }
    }
  }
};

const DEFAULT_AGENT_CONFIG = {
  name: 'Assistant',
  tone: 'playful',
  response_style: 'short',
  engagement_level: 3,
  memory_enabled: true,
  language: 'spanish'
};

/**
 * Create a new agent for a user
 * @param {number} userId - The user ID
 * @param {object} config - Agent configuration
 * @returns {Promise<object>} - Created agent
 */
const createAgent = async (userId, config = {}) => {
  // Ensure userId is an integer
  const userIdInt = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  // Check if user is premium
  const user = await prisma.adminUser.findUnique({
    where: { id: userIdInt },
    select: { plan: true }
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Check if agent already exists
  const existing = await prisma.agent.findUnique({
    where: { user_id: userIdInt }
  });

  if (existing) {
    logger.info(`Agent already exists for user ${userIdInt}`);
    return existing;
  }

  const agentData = {
    user_id: userIdInt,
    name: config.name || DEFAULT_AGENT_CONFIG.name,
    tone: config.tone || DEFAULT_AGENT_CONFIG.tone,
    response_style: config.response_style || DEFAULT_AGENT_CONFIG.response_style,
    engagement_level: config.engagement_level || DEFAULT_AGENT_CONFIG.engagement_level,
    memory_enabled: config.memory_enabled ?? DEFAULT_AGENT_CONFIG.memory_enabled,
    language: config.language || DEFAULT_AGENT_CONFIG.language,
    personality_config: config.personality_config || DEFAULT_PERSONALITY,
    business_name: config.business_name || null,
    business_type: config.business_type || null,
    products_services: config.products_services || null,
    sales_strategy: config.sales_strategy || null,
    restrictions: config.restrictions || null
  };

  // Generate initial system prompt
  agentData.system_prompt = generateSystemPrompt(agentData);

  const agent = await prisma.agent.create({
    data: agentData
  });

  logger.info(`Created agent for user ${userIdInt}: ${agent.name}`);
  return agent;
};

/**
 * Get agent by user ID
 * @param {number} userId - The user ID
 * @returns {Promise<object|null>} - Agent or null
 */
const getAgent = async (userId) => {
  // Ensure userId is an integer
  const userIdInt = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  return prisma.agent.findUnique({
    where: { user_id: userIdInt },
    include: {
      conversations: {
        orderBy: { last_message_at: 'desc' },
        take: 10
      }
    }
  });
};

/**
 * Update agent configuration
 * @param {number} userId - The user ID
 * @param {object} updates - Fields to update
 * @returns {Promise<object>} - Updated agent
 */
const updateAgent = async (userId, updates) => {
  // Ensure userId is an integer
  const userIdInt = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  const agent = await prisma.agent.findUnique({
    where: { user_id: userIdInt }
  });

  if (!agent) {
    throw new Error('Agent not found');
  }

  const updateData = { ...updates };

  // Regenerate system prompt if relevant fields changed
  const promptFields = ['name', 'tone', 'personality_config', 'business_name', 'business_type',
                       'products_services', 'sales_strategy', 'restrictions', 'language'];
  const needsRegen = promptFields.some(field => updates[field] !== undefined);

  if (needsRegen) {
    const mergedAgent = { ...agent, ...updates };
    updateData.system_prompt = generateSystemPrompt(mergedAgent);
  }

  const updated = await prisma.agent.update({
    where: { user_id: userIdInt },
    data: updateData
  });

  logger.info(`Updated agent for user ${userIdInt}`);
  return updated;
};

/**
 * Delete agent for a user (when downgrading from premium)
 * @param {number} userId - The user ID
 * @returns {Promise<void>}
 */
const deleteAgent = async (userId) => {
  // Ensure userId is an integer
  const userIdInt = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  await prisma.agent.delete({
    where: { user_id: userIdInt }
  }).catch(err => {
    if (err.code !== 'P2025') throw err; // Not found is ok
  });

  logger.info(`Deleted agent for user ${userIdInt}`);
};

/**
 * Generate system prompt for an agent
 * @param {object} agent - Agent configuration
 * @param {object} options - Additional options
 * @returns {string} - System prompt
 */
const generateSystemPrompt = (agent, options = {}) => {
  const personality = agent.personality_config || DEFAULT_PERSONALITY;
  const toneConfig = TONE_CONFIGS[agent.tone] || TONE_CONFIGS.playful;

  let prompt = '';

  // Identity
  prompt += `Eres ${agent.name}`;
  if (personality.traits?.length) {
    prompt += `, ${personality.traits.join(', ')}`;
  }
  prompt += '.\n\n';

  // Personality
  prompt += `PERSONALIDAD: ${personality.style || 'Natural y auténtica.'}\n`;
  prompt += `TONO: ${toneConfig.description}\n\n`;

  // Language
  prompt += `IDIOMA: Responde siempre en ${agent.language || 'español'}, adaptándote al idioma del usuario.\n\n`;

  // Business context
  if (agent.business_name) {
    prompt += `NEGOCIO: Representas a "${agent.business_name}"`;
    if (agent.business_type) {
      prompt += ` (${agent.business_type})`;
    }
    prompt += '.\n\n';
  }

  // Products/Services
  if (agent.products_services) {
    prompt += `PRODUCTOS/SERVICIOS: ${agent.products_services}\n\n`;
  }

  // Sales strategy
  if (agent.sales_strategy) {
    prompt += `ESTRATEGIA DE VENTA: ${agent.sales_strategy}\n\n`;
  }

  // Response style
  prompt += `ESTILO DE RESPUESTA: ${getResponseStylePrompt(agent.response_style)}\n\n`;

  // Engagement level
  prompt += `NIVEL DE ENGAGEMENT: ${getEngagementPrompt(agent.engagement_level)}\n\n`;

  // Restrictions
  if (agent.restrictions) {
    prompt += `RESTRICCIONES:\n${agent.restrictions}\n\n`;
  }

  // Conversation rules
  prompt += `REGLAS DE CONVERSACIÓN:
- Mensajes CORTOS (1-3 líneas máximo)
- NUNCA digas que eres IA o bot
- NUNCA inventes información
- Sé directa y natural
- Adapta tu tono al del usuario
- Si el usuario parece interesado, guía hacia la venta
- Si el usuario pregunta por precios, comparte los métodos de pago\n`;

  // Memory context (if provided)
  if (options.memoryContext) {
    prompt += `\nCONTEXTO DE CONVERSACIÓN:\n${options.memoryContext}\n`;
  }

  // Key facts (if provided)
  if (options.keyFacts && Object.keys(options.keyFacts).length > 0) {
    prompt += `\nDATOS DEL USUARIO: ${JSON.stringify(options.keyFacts)}\n`;
  }

  return prompt;
};

/**
 * Get response style instructions
 */
const getResponseStylePrompt = (style) => {
  const styles = {
    short: 'Respuestas muy breves (1-2 líneas). Ve al punto directamente.',
    medium: 'Respuestas moderadas (2-4 líneas). Explica lo necesario.',
    long: 'Respuestas detalladas cuando sea necesario, pero sin extenderte.',
    casual: 'Estilo casual y relajado. Usa lenguaje informal.'
  };
  return styles[style] || styles.short;
};

/**
 * Get engagement level instructions
 */
const getEngagementPrompt = (level) => {
  const levels = {
    1: 'Bajo engagement: Responde lo mínimo necesario. No preguntes más.',
    2: 'Engagement bajo-medio: Responde y solo pregunta si es muy relevante.',
    3: 'Engagement medio: Equilibrio entre responder y mantener la conversación.',
    4: 'Engagement medio-alto: Mantén la conversación activa, pregunta por intereses.',
    5: 'Alto engagement: Sé proactiva, sugiere, pregunta, guía la conversación.'
  };
  return levels[level] || levels[3];
};

/**
 * Get agent for message processing (with caching)
 * @param {number} userId - The user ID
 * @returns {Promise<object|null>} - Agent or null (for free users)
 */
const getAgentForUser = async (userId) => {
  // Ensure userId is an integer
  const userIdInt = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  // Check user plan first
  const user = await prisma.adminUser.findUnique({
    where: { id: userIdInt },
    select: { plan: true }
  });

  if (!user || user.plan !== 'premium') {
    return null; // Free users don't have agents
  }

  // Get or create agent
  let agent = await prisma.agent.findUnique({
    where: { user_id: userIdInt }
  });

  if (!agent) {
    // Auto-create agent for premium users
    agent = await createAgent(userIdInt);
  }

  return agent;
};

/**
 * Get default config for free users
 * @returns {object} - Default configuration
 */
const getDefaultConfig = () => {
  return {
    ...DEFAULT_AGENT_CONFIG,
    personality_config: DEFAULT_PERSONALITY,
    system_prompt: generateSystemPrompt({
      name: 'Assistant',
      tone: 'playful',
      response_style: 'short',
      engagement_level: 3,
      personality_config: DEFAULT_PERSONALITY
    })
  };
};

/**
 * Regenerate system prompt for an agent
 * @param {number} userId - The user ID
 * @returns {Promise<string>} - New system prompt
 */
const regenerateSystemPrompt = async (userId) => {
  // Ensure userId is an integer
  const userIdInt = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  const agent = await prisma.agent.findUnique({
    where: { user_id: userIdInt }
  });

  if (!agent) {
    throw new Error('Agent not found');
  }

  const newPrompt = generateSystemPrompt(agent);

  await prisma.agent.update({
    where: { user_id: userIdInt },
    data: { system_prompt: newPrompt }
  });

  return newPrompt;
};

/**
 * Get available tones
 * @returns {object} - Tone configurations
 */
const getAvailableTones = () => {
  return Object.entries(TONE_CONFIGS).map(([key, config]) => ({
    key,
    description: config.description
  }));
};

/**
 * Clone agent from template
 * @param {number} userId - The user ID
 * @param {number} templateId - Template ID
 * @returns {Promise<object>} - Created agent
 */
const cloneFromTemplate = async (userId, templateId) => {
  const template = await prisma.agentTemplate.findUnique({
    where: { id: templateId }
  });

  if (!template) {
    throw new Error('Template not found');
  }

  return createAgent(userId, {
    name: template.name,
    personality_config: template.personality_config,
    tone: template.tone,
    response_style: template.response_style,
    engagement_level: template.engagement_level,
    restrictions: template.default_restrictions,
    products_services: template.suggested_products
  });
};

module.exports = {
  createAgent,
  getAgent,
  updateAgent,
  deleteAgent,
  getAgentForUser,
  generateSystemPrompt,
  regenerateSystemPrompt,
  getDefaultConfig,
  getAvailableTones,
  cloneFromTemplate,
  DEFAULT_PERSONALITY,
  DEFAULT_AGENT_CONFIG,
  TONE_CONFIGS
};