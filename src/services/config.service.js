const prisma = require('../config/database');
const logger = require('../utils/logger');

const DEFAULT_CONFIG = {
  bot_name: 'Shey',
  bot_location: 'Costa Rica',
  bot_age: 25,
  paypal_link: 'https://www.paypal.com/donate/?hosted_button_id=7Z7NXWUNGDBYW',
  sinpe_number: '61714036',
  products: 'Sexting personalizado,Videollamadas privadas,Packs de fotos/videos,Videos personalizados',
  personality: 'Caliente, atrevida, sin filtro. Te gusta hablar sucio. Coqueta pero no empalagosa.',
  response_style: 'short',
  tone: 'playful',
  message_style: '["short","casual"]',
  engagement_level: 3,
  sales_strategy: null,
  restrictions: null,
  typing_delay: true,
  typing_speed_min: 200,
  typing_speed_max: 400,
  media_keyword_trigger: true,
  payment_confirm_message: '📸 ¡Recibí tu comprobante!\n\n✅ Voy a verificarlo, muchas gracias por tu compra! 💕\n\nTe aviso en cuanto esté listo.',
  user_gender_mode: 'auto'
};

const getConfig = async () => {
  let config = await prisma.botConfig.findUnique({ where: { id: 1 } });

  if (!config) {
    config = await prisma.botConfig.create({
      data: { id: 1, ...DEFAULT_CONFIG }
    });
    logger.info('Created default bot config');
  }

  logger.debug(`Bot config loaded: user_gender_mode=${config.user_gender_mode}`);
  return config;
};

const updateConfig = async (data) => {
  logger.debug(`Updating bot config with data: ${JSON.stringify(data)}`);

  const config = await prisma.botConfig.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...DEFAULT_CONFIG, ...data }
  });

  logger.info('Bot config updated');
  return config;
};

// Get personality-specific config
const getPersonalityConfig = async () => {
  const config = await getConfig();

  // Parse message_style from JSON string
  let messageStyle = ['short', 'casual'];
  try {
    if (config.message_style) {
      messageStyle = JSON.parse(config.message_style);
    }
  } catch (e) {
    logger.warn('Failed to parse message_style, using default');
  }

  return {
    personality: config.personality,
    tone: config.tone,
    messageStyle,
    engagementLevel: config.engagement_level,
    salesStrategy: config.sales_strategy,
    restrictions: config.restrictions,
    botName: config.bot_name,
    botLocation: config.bot_location,
    botAge: config.bot_age
  };
};

// Update personality config
const updatePersonalityConfig = async (data) => {
  const updateData = {
    personality: data.personality,
    tone: data.tone,
    engagement_level: data.engagement,
    sales_strategy: data.salesStrategy,
    restrictions: data.restrictions
  };

  // Convert messageStyle array to JSON string
  if (data.style && Array.isArray(data.style)) {
    updateData.message_style = JSON.stringify(data.style);
  }

  return updateConfig(updateData);
};

module.exports = {
  getConfig,
  updateConfig,
  getPersonalityConfig,
  updatePersonalityConfig,
  DEFAULT_CONFIG
};