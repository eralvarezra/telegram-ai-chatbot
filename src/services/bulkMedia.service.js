const mediaService = require('./media.service');
const userService = require('./user.service');
const configService = require('./config.service');
const userCredentialsService = require('./userCredentials.service');
const setupService = require('./setup.service');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

/**
 * Generate a natural, varied caption for media using AI
 */
const generateNaturalCaption = async (media, botConfig, ownerId = null) => {
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
      // Fallback to simple caption
      return generateFallbackCaption(media, botConfig);
    }

    const botName = botConfig.bot_name || 'Shey';
    const botTone = botConfig.tone || 'playful';
    const keywords = media.keywords?.split(',')[0]?.trim() || 'contenido';
    const title = media.title || 'Contenido exclusivo';

    const systemPrompt = `Eres ${botName}, una chica real enviando contenido por Telegram. Genera un caption CORTO y NATURAL para una ${media.file_type === 'image' ? 'foto' : 'video'}.

REGLAS IMPORTANTES:
- Máximo 1-2 líneas
- Son natural, como si estuvieras chateando con alguien real
- NUNCA uses el template "Aquí tienes {keyword}"
- VARÍA cada mensaje - nunca repites
- No digas "te envío" o "aquí tienes" - el contenido YA está adjunto
- Puedes hacer referencia al contenido de forma sutil

El contenido es: ${title}
Keywords: ${keywords}
${media.price ? `Precio: $${media.price}` : ''}

Tono: ${botTone === 'serious' ? 'Profesional y formal' : botTone === 'sexy' ? 'Coqueto y sugerente' : botTone === 'explicit' ? 'Directo y atrevido' : 'Amigable y juguetón'}

Responde SOLO con el caption, nada más. Sin comillas ni explicaciones.`;

    const client = new OpenAI({
      apiKey: aiCreds.apiKey,
      baseURL: aiCreds.provider === 'groq' ? 'https://api.groq.com/openai/v1' : undefined
    });

    const completion = await client.chat.completions.create({
      model: aiCreds.provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Genera un caption corto y natural' }
      ],
      max_tokens: 60,
      temperature: 0.9
    });

    let caption = completion.choices[0]?.message?.content?.trim() || '';

    // Add price if available
    if (media.price) {
      const priceText = media.price >= 1 ? `$${media.price}` : `${Math.round(media.price * 100)}¢`;
      caption += `\n\nDesbloquea por ${priceText} 💸`;
    }

    return caption;
  } catch (error) {
    logger.error('Error generating caption:', error);
    return generateFallbackCaption(media, botConfig);
  }
};

/**
 * Fallback caption when AI fails
 */
const generateFallbackCaption = (media, botConfig) => {
  const keywords = media.keywords?.split(',')[0]?.trim() || 'contenido';
  const title = media.title || 'Contenido exclusivo';
  const botName = botConfig.bot_name || 'Shey';

  // Varied fallback messages
  const fallbacks = [
    `${title} ${botName === 'Shey' ? 'bb' : '💕'}`,
    `Mira esto ${botName === 'Shey' ? 'rico' : '💖'}`,
    `${keywords} ${botName === 'Shey' ? 'para ti' : '💋'}`,
    `Te va a gustar ${botName === 'Shey' ? '😏' : '🔥'}`,
    `${title} ¿qué tal?`
  ];

  let caption = fallbacks[Math.floor(Math.random() * fallbacks.length)];

  if (media.price) {
    const priceText = media.price >= 1 ? `$${media.price}` : `${Math.round(media.price * 100)}¢`;
    caption += `\n\nDesbloquea por ${priceText} 💸`;
  }

  return caption;
};

/**
 * Generate natural follow-up message using AI
 */
const generateFollowUpMessage = async (mediaCount, botConfig, ownerId = null) => {
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
      return getFallbackFollowUp(botConfig, mediaCount);
    }

    const botName = botConfig.bot_name || 'Shey';
    const botTone = botConfig.tone || 'playful';

    const systemPrompt = `Eres ${botName} enviando contenido por Telegram. El usuario acaba de recibir ${mediaCount} ${mediaCount === 1 ? 'foto/video' : 'fotos/videos'}.

Genera un mensaje de seguimiento CORTO y NATURAL (1-2 líneas máximo) para continuar la conversación.

REGLAS:
- Son natural, como si estuvieras chateando de verdad
- NUNCA digas "te envié" o "aquí está" - el usuario YA vio el contenido
- El objetivo es que te diga cuál le gustó o si quiere ver más
- VARÍA cada mensaje - nunca repites
- Invita a interactuar de forma sutil

Tono: ${botTone === 'serious' ? 'Profesional' : botTone === 'sexy' ? 'Coqueto' : botTone === 'explicit' ? 'Atrevido' : 'Juguetón'}

Responde SOLO con el mensaje, nada más. Sin comillas.`;

    const client = new OpenAI({
      apiKey: aiCreds.apiKey,
      baseURL: aiCreds.provider === 'groq' ? 'https://api.groq.com/openai/v1' : undefined
    });

    const completion = await client.chat.completions.create({
      model: aiCreds.provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Genera un mensaje de seguimiento corto y natural' }
      ],
      max_tokens: 80,
      temperature: 0.9
    });

    return completion.choices[0]?.message?.content?.trim() || getFallbackFollowUp(botConfig, mediaCount);
  } catch (error) {
    logger.error('Error generating follow-up:', error);
    return getFallbackFollowUp(botConfig, mediaCount);
  }
};

/**
 * Fallback follow-up messages
 */
const getFallbackFollowUp = (botConfig, mediaCount) => {
  const botName = botConfig.bot_name || 'Shey';
  const isMultiple = mediaCount > 1;

  const fallbacks = isMultiple ? [
    `¿Cuál te gustó más ${botName === 'Shey' ? 'bb' : ''}? 💕`,
    `Dime cuál quieres ver completo ${botName === 'Shey' ? '😏' : '💋'}`,
    `¿Te gustó algo ${botName === 'Shey' ? 'rico' : ''}? 💖`,
    `Mira todos y dime ${botName === 'Shey' ? 'cuál quieres' : '🔥'}`,
    `Tengo más si quieres ${botName === 'Shey' ? 'bb' : '💕'}`
  ] : [
    `¿Te gustó ${botName === 'Shey' ? 'bb' : ''}? 💕`,
    `¿Quieres ver más ${botName === 'Shey' ? 'rico' : ''}? 💖`,
    `Tengo más así ${botName === 'Shey' ? 'si quieres' : '🔥'}`
  ];

  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
};

/**
 * Send bulk media to a user via Telegram
 * @param {object} client - Telegram client
 * @param {string} telegramId - User's Telegram ID
 * @param {string|null} ownerId - Owner ID for multi-tenant
 * @param {object} options - Additional options
 * @returns {Promise<{success: boolean, sent: number, mediaIds: number[]}>}
 */
const sendBulkMedia = async (client, telegramId, ownerId = null, options = {}) => {
  const { limit = 5, includeCaption = true, followUpMessage = true } = options;

  try {
    // Get user for tracking views
    const user = await userService.findOrCreateUserWithInstance(telegramId, null);

    // Get bulk media content
    const mediaItems = await mediaService.getBulkMedia(ownerId, user.user?.id || user.id, limit);

    if (mediaItems.length === 0) {
      logger.warn(`No media available to send to user ${telegramId}`);
      return {
        success: false,
        reason: 'no_media',
        message: 'No tengo contenido disponible ahorita, pero te aviso cuando tenga algo nuevo 💕'
      };
    }

    logger.info(`Sending ${mediaItems.length} media items to user ${telegramId}`);

    // Get bot config
    const botConfig = await configService.getConfig();

    // Convert telegramId to number for Telegram API
    const senderIdNumber = Number(telegramId);
    const entity = await client.getInputEntity(senderIdNumber);

    const sentMediaIds = [];

    // Send media
    if (mediaItems.length > 1) {
      // Multiple items - send with small delay between them
      for (let i = 0; i < mediaItems.slice(0, 10).length; i++) {
        const media = mediaItems[i];
        const filePath = path.join(__dirname, '../../uploads', media.file_path);

        if (!fs.existsSync(filePath)) {
          logger.warn(`Media file not found: ${filePath}`);
          continue;
        }

        // Generate natural caption for first item only (Telegram albums show only first caption)
        let caption = '';
        if (includeCaption && i === 0) {
          caption = await generateNaturalCaption(media, botConfig, ownerId);
        }

        try {
          await client.sendFile(entity, {
            file: filePath,
            caption: caption,
            forceDocument: false
          });

          sentMediaIds.push(media.id);

          // Small delay between sends
          if (i < mediaItems.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 350));
          }
        } catch (sendError) {
          logger.error(`Error sending media item ${i}:`, sendError.message);
        }
      }
    } else {
      // Single media item
      const media = mediaItems[0];
      const filePath = path.join(__dirname, '../../uploads', media.file_path);

      if (!fs.existsSync(filePath)) {
        logger.warn(`Media file not found: ${filePath}`);
        return {
          success: false,
          reason: 'file_not_found',
          message: 'El contenido no está disponible ahorita.'
        };
      }

      let caption = '';
      if (includeCaption) {
        caption = await generateNaturalCaption(media, botConfig, ownerId);
      }

      try {
        await client.sendFile(entity, {
          file: filePath,
          caption: caption,
          forceDocument: false
        });

        sentMediaIds.push(media.id);
      } catch (sendError) {
        logger.error('Error sending single media:', sendError.message);
        return {
          success: false,
          reason: 'send_error',
          message: 'Error al enviar el contenido.'
        };
      }
    }

    // Record views for all sent media
    for (const mediaId of sentMediaIds) {
      try {
        await mediaService.recordMediaView(user.user?.id || user.id, mediaId, ownerId);
      } catch (viewError) {
        logger.debug('Could not record view:', viewError.message);
      }
    }

    // Send AI-generated follow-up message
    if (followUpMessage && sentMediaIds.length > 0) {
      const followUp = await generateFollowUpMessage(sentMediaIds.length, botConfig, ownerId);
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        await client.sendMessage(entity, { message: followUp });
      } catch (msgError) {
        logger.error('Error sending follow-up message:', msgError.message);
      }
    }

    return {
      success: true,
      sent: sentMediaIds.length,
      mediaIds: sentMediaIds
    };
  } catch (error) {
    logger.error('Error in sendBulkMedia:', error);
    return {
      success: false,
      reason: 'error',
      message: 'Error al procesar tu solicitud. Intenta de nuevo.'
    };
  }
};

/**
 * Generate bulk media response text (for AI context)
 */
const generateBulkMediaContext = () => {
  return {
    sentMedia: true,
    mediaType: 'bulk',
    followUpSent: true
  };
};

module.exports = {
  sendBulkMedia,
  generateNaturalCaption,
  generateFollowUpMessage,
  generateBulkMediaContext
};