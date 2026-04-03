const userService = require('./services/user.service');
const messageService = require('./services/message.service');
const mediaService = require('./services/media.service');
const aiService = require('./services/ai.service');
const telegramService = require('./services/telegram.service');
const config = require('./config');
const configService = require('./services/config.service');
const paymentFlowService = require('./services/paymentFlow.service');
const botInstanceService = require('./services/botInstance.service');
const blockedUsersService = require('./services/blockedUsers.service');
const intentClassifier = require('./services/intentClassifier.service');
const bulkMediaService = require('./services/bulkMedia.service');
const conversationState = require('./services/conversationState.service');
const servicesMenu = require('./services/servicesMenu.service');
const rateLimitService = require('./services/rateLimit.service');
const apiKeyService = require('./services/apiKey.service');
const prisma = require('./config/database');
const logger = require('./utils/logger');
const fs = require('fs');
const path = require('path');

// Message buffer for grouping consecutive messages
// Structure: Map<telegramId, { messages: [], timeout: Timeout, userData: {} }>
const messageBuffer = new Map();
const BUFFER_WAIT_TIME = 10000; // Wait 10 seconds for more messages

// Simulate realistic typing delay
const calculateTypingDelay = (text) => {
  const baseDelay = 1000 + Math.random() * 2000;
  const typingSpeed = 250 + Math.random() * 150;
  const typingTime = Math.min(text.length * typingSpeed, 15000);
  const randomFactor = 0.8 + Math.random() * 0.4;
  return Math.floor((baseDelay + typingTime) * randomFactor);
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to get entity safely
const getEntitySafe = async (client, telegramId, event = null) => {
  try {
    // Try to get from event sender first
    if (event && event.sender) {
      return event.sender;
    }

    // Try getInputEntity
    const senderIdNumber = Number(telegramId);
    try {
      return await client.getInputEntity(senderIdNumber);
    } catch (e) {
      logger.debug('getInputEntity failed, trying getEntity...');
    }

    // Try getEntity as fallback
    try {
      const entity = await client.getEntity(senderIdNumber);
      return entity;
    } catch (e) {
      logger.debug('getEntity also failed');
    }

    return null;
  } catch (error) {
    logger.error('Error getting entity:', error.message);
    return null;
  }
};

// Download photo from Telegram
const downloadPhoto = async (client, message, telegramId) => {
  try {
    const photo = message.photo;
    if (!photo) return null;

    logger.info('Processing photo download...');

    const proofsDir = path.join(__dirname, '../uploads/proofs');
    if (!fs.existsSync(proofsDir)) {
      fs.mkdirSync(proofsDir, { recursive: true });
    }

    const fileName = `proof_${telegramId}_${Date.now()}.jpg`;
    const filePath = path.join(proofsDir, fileName);

    try {
      const buffer = await client.downloadMedia(photo, {});
      if (buffer && buffer.length > 0) {
        fs.writeFileSync(filePath, buffer);
        logger.info(`Downloaded payment proof: ${fileName}`);
        return `proofs/${fileName}`;
      }
    } catch (e) {
      logger.debug('downloadMedia failed, trying downloadFile...');
    }

    try {
      const sizes = photo.sizes || [];
      if (sizes.length > 0) {
        const largest = sizes.reduce((prev, curr) => {
          const prevSize = (prev.w || 0) * (prev.h || 0);
          const currSize = (curr.w || 0) * (curr.h || 0);
          return currSize > prevSize ? curr : prev;
        });

        const buffer = await client.downloadMedia(largest, {});
        if (buffer && buffer.length > 0) {
          fs.writeFileSync(filePath, buffer);
          logger.info(`Downloaded payment proof: ${fileName}`);
          return `proofs/${fileName}`;
        }
      }
    } catch (e) {
      logger.error('Fallback download also failed:', e.message);
    }

    logger.error('Could not download photo - no valid method found');
    return null;
  } catch (error) {
    logger.error('Error downloading photo:', error.message);
    return null;
  }
};

/**
 * Process accumulated messages for a user
 * @param {string} telegramId - User's Telegram ID
 * @param {object} client - Telegram client
 * @param {object} event - Original event
 * @param {string|null} ownerId - Bot owner ID
 */
const processBufferedMessages = async (telegramId, client, event, ownerId) => {
  const buffer = messageBuffer.get(telegramId);
  if (!buffer || buffer.messages.length === 0) {
    messageBuffer.delete(telegramId);
    return;
  }

  // Remove from map to prevent duplicate processing
  messageBuffer.delete(telegramId);

  const { messages, userData } = buffer;
  const combinedText = messages.join(' ');

  logger.info(`Processing ${messages.length} buffered messages from ${telegramId}: "${combinedText.substring(0, 100)}..."`);

  // Process as a single combined message
  await processMessage(telegramId, combinedText, client, event, ownerId, userData);
};

/**
 * Core message processing logic (separated from handleMessage for buffering)
 */
const processMessage = async (telegramId, text, client, event, ownerId, userData = {}) => {
  try {
    const { senderUsername, senderFirstName, senderLastName, senderDisplayName, user, wasReset } = userData;

    // Check if message contains a photo (payment proof)
    const hasPhoto = event.message?.photo && (event.message.photo.sizes || event.message.photo.length > 0);

    if (hasPhoto) {
      // Handle photo separately - not buffered
      const message = event.message;
      logger.info(`Processing payment proof from ${telegramId}`);

      const photoPath = await downloadPhoto(client, message, telegramId);
      const pendingPayments = await paymentFlowService.getUserPendingPayments(telegramId);

      if (pendingPayments.length > 0) {
        if (photoPath) {
          await paymentFlowService.addPaymentProof(pendingPayments[0].id, photoPath);
        }
        const replyText = '📸 ¡Recibí tu comprobante!\n\n✅ Voy a verificarlo, muchas gracias por tu compra! 💕\n\nTe aviso en cuanto esté listo.';
        await event.message.reply({ message: replyText });
        await messageService.saveMessage(user.id, 'user', '[ENVIÓ FOTO - COMPROBANTE]');
        await messageService.saveMessage(user.id, 'assistant', replyText);
        return;
      }

      await paymentFlowService.createPendingPayment(telegramId, 'sinpe', photoPath, ownerId);
      const replyText = await paymentFlowService.getPhotoReceivedResponse('sinpe');
      await event.message.reply({ message: replyText });
      await messageService.saveMessage(user.id, 'user', '[ENVIÓ FOTO - COMPROBANTE]');
      await messageService.saveMessage(user.id, 'assistant', replyText);
      return;
    }

    // Handle payment question
    if (paymentFlowService.isPaymentQuestion(text)) {
      logger.info(`Payment question from ${telegramId}: ${text}`);
      await messageService.saveMessage(user.id, 'user', text);

      const useManualResponse = await paymentFlowService.shouldUseManualPaymentResponse();

      if (useManualResponse) {
        const replyText = paymentFlowService.getManualPaymentResponse();
        await event.message.reply({ message: replyText });
        await messageService.saveMessage(user.id, 'assistant', replyText);
        await paymentFlowService.notifyManualPaymentRequest(ownerId, telegramId);
        return;
      }

      const replyText = await paymentFlowService.getPaymentInfoResponse();

      if (!replyText) {
        const manualText = paymentFlowService.getManualPaymentResponse();
        await event.message.reply({ message: manualText });
        await messageService.saveMessage(user.id, 'assistant', manualText);
        await paymentFlowService.notifyManualPaymentRequest(ownerId, telegramId);
        return;
      }

      await event.message.reply({ message: replyText });
      await messageService.saveMessage(user.id, 'assistant', replyText);
      return;
    }

    // Save user message (single combined message)
    await messageService.saveMessage(user.id, 'user', text);

    // Rate limiting check for free users (ownerId is the bot owner)
    if (ownerId) {
      try {
        // Ensure ownerId is an integer
        const ownerIdInt = typeof ownerId === 'string' ? parseInt(ownerId, 10) : ownerId;

        // Get the owner's plan
        const owner = await prisma.adminUser.findUnique({
          where: { id: ownerIdInt },
          select: { plan: true }
        });

        if (owner && owner.plan === 'free') {
          // Check if owner has API key configured
          const keyStatus = await apiKeyService.getApiKeyStatus(ownerIdInt);

          if (!keyStatus.hasKey) {
            const limitMessage = '⚠️ Para usar este bot, necesitas configurar tu API key.\n\nVe a la configuración y añade tu API key de Groq u OpenAI para continuar.';
            await event.message.reply({ message: limitMessage });
            await messageService.saveMessage(user.id, 'assistant', limitMessage);
            return;
          }

          // Check daily message limit
          const limitCheck = await rateLimitService.checkDailyLimit(ownerIdInt);

          if (!limitCheck.allowed) {
            const resetTimeStr = limitCheck.resetTime
              ? new Date(limitCheck.resetTime).toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit' })
              : 'medianoche';

            const limitMessage = `🚫 Has alcanzado tu límite diario de ${limitCheck.limit} mensajes.\n\nTu límite se reiniciará a las ${resetTimeStr}.\n\n💡 Actualiza a premium para acceso ilimitado.`;
            await event.message.reply({ message: limitMessage });
            await messageService.saveMessage(user.id, 'assistant', limitMessage);
            return;
          }
        }
      } catch (limitError) {
        logger.error('Error checking rate limit:', limitError.message);
        // Continue if rate limit check fails - don't block the user
      }
    }

    // Get bot config
    const botConfig = await configService.getConfig();

    // Check conversation state for pending selection
    const pendingState = conversationState.getPendingSelection(telegramId);

    if (pendingState) {
      // User is responding to a services menu
      logger.info(`User ${telegramId} is making a selection from the menu`);

      // Try to match selection directly from text first
      let selectedService = servicesMenu.getServiceBySelection(pendingState.services, text);

      // If no direct match, try with intent classifier
      if (!selectedService) {
        const intentResult = await intentClassifier.classifyIntent(text, ownerId);
        if (intentResult.intent === intentClassifier.INTENT_TYPES.SERVICE_SELECTION && intentResult.selected_option) {
          selectedService = servicesMenu.getServiceBySelection(pendingState.services, intentResult.selected_option);
        }
      }

      if (selectedService) {
        logger.info(`User ${telegramId} selected: ${selectedService.name}`);

        // Clear state
        conversationState.clearState(telegramId);

        // Get entity safely
        const entity = await getEntitySafe(client, telegramId, event);

        // Check if product has a valid description
        const hasDescription = selectedService.description && selectedService.description.trim().length > 0;

        if (selectedService.hasMedia) {
          // Get media related to this service
          let matchingMedia = [];

          // If service has productId (from database), search by product_id
          if (selectedService.productId) {
            matchingMedia = await mediaService.getAllMedia({
              ownerUserId: ownerId,
              isActive: true,
              productId: selectedService.productId
            });
          } else {
            // Fallback: search by keywords
            const serviceMedia = await mediaService.getAllMedia({ ownerUserId: ownerId, isActive: true });
            matchingMedia = serviceMedia.filter(m =>
              m.keywords?.toLowerCase().includes(selectedService.name.toLowerCase()) ||
              selectedService.name.toLowerCase().includes(m.keywords?.split(',')[0]?.toLowerCase())
            );
          }

          if (matchingMedia.length > 0) {
            // Send up to 10 items for this service (without individual captions)
            const itemsToSend = matchingMedia.slice(0, 10);

            for (const media of itemsToSend) {
              const filePath = path.join(__dirname, '../uploads', media.file_path);

              if (fs.existsSync(filePath)) {
                try {
                  // Send using entity or fallback to message.reply
                  if (entity) {
                    await client.sendFile(entity, {
                      file: filePath,
                      forceDocument: false
                    });
                  } else {
                    // Fallback: use message.reply for files
                    await event.message.reply({ file: filePath, message: '' });
                  }

                  await mediaService.recordMediaView(user.id, media.id, ownerId);

                  await sleep(300);
                } catch (sendError) {
                  logger.error('Error sending service media:', sendError.message);
                }
              }
            }

            // After sending media, check description
            if (hasDescription) {
              // Has description + media: send description
              await sleep(500);
              if (entity) {
                await client.sendMessage(entity, { message: selectedService.description });
              } else {
                await event.message.reply({ message: selectedService.description });
              }
              await messageService.saveMessage(user.id, 'assistant', selectedService.description);
            } else {
              // Only media, no description: generate brief AI follow-up
              await sleep(500);
              const askMessage = await servicesMenu.generateMediaFollowUpMessage(botConfig, itemsToSend.length, ownerId);
              if (entity) {
                await client.sendMessage(entity, { message: askMessage });
              } else {
                await event.message.reply({ message: askMessage });
              }
              await messageService.saveMessage(user.id, 'assistant', askMessage);
            }
          } else {
            // No media found (but product has hasMedia flag)
            if (hasDescription) {
              // Only description, no media: send just description
              await sleep(500);
              if (entity) {
                await client.sendMessage(entity, { message: selectedService.description });
              } else {
                await event.message.reply({ message: selectedService.description });
              }
              await messageService.saveMessage(user.id, 'assistant', selectedService.description);
            } else {
              // No media and no description: generate default message
              const defaultMessage = `¡Esa es una excelente elección! 💕 En breve te envío los detalles de ${selectedService.name}.`;
              if (entity) {
                await client.sendMessage(entity, { message: defaultMessage });
              } else {
                await event.message.reply({ message: defaultMessage });
              }
              await messageService.saveMessage(user.id, 'assistant', defaultMessage);
            }
          }
        } else {
          // Service has no media flag
          if (hasDescription) {
            // Only description, no media: send just description
            if (entity) {
              await client.sendMessage(entity, { message: selectedService.description });
            } else {
              await event.message.reply({ message: selectedService.description });
            }
            await messageService.saveMessage(user.id, 'assistant', selectedService.description);
          } else {
            // No media and no description: generate AI confirmation
            const confirmMessage = await servicesMenu.generateServiceConfirmationMessage(selectedService, botConfig, ownerId);
            if (entity) {
              await client.sendMessage(entity, { message: confirmMessage });
            } else {
              await event.message.reply({ message: confirmMessage });
            }
            await messageService.saveMessage(user.id, 'assistant', confirmMessage);
          }
        }

        logger.info(`Service selection complete for ${telegramId}`);
        return;
      }

      // Invalid selection - check if it's a conversation intent or redirect back to menu
      logger.debug(`Invalid selection from ${telegramId}: ${text}`);

      // intentResult is already declared above, reuse it

      // If it's a conversational message, respond naturally and redirect to menu
      // Check BUY intent first
      const intentResult = await intentClassifier.classifyIntent(text, ownerId);

      if (intentResult.intent === intentClassifier.INTENT_TYPES.BUY && intentResult.confidence >= 0.7) {
        logger.info(`User ${telegramId} wants to buy now`);

        // Clear state - user is ready to purchase
        conversationState.clearState(telegramId);

        // Send payment methods
        const entity = await getEntitySafe(client, telegramId, event);
        const paymentInfo = await paymentFlowService.getPaymentInfoResponse();

        if (paymentInfo) {
          if (entity) {
            await client.sendMessage(entity, { message: paymentInfo });
          } else {
            await event.message.reply({ message: paymentInfo });
          }
          await messageService.saveMessage(user.id, 'assistant', paymentInfo);
        } else {
          const manualText = paymentFlowService.getManualPaymentResponse();
          if (entity) {
            await client.sendMessage(entity, { message: manualText });
          } else {
            await event.message.reply({ message: manualText });
          }
          await messageService.saveMessage(user.id, 'assistant', manualText);
          await paymentFlowService.notifyManualPaymentRequest(ownerId, telegramId);
        }

        logger.info(`Payment info sent to ${telegramId}`);
        return;
      }

      // Check PAYMENT_METHOD intent
      if (intentResult.intent === intentClassifier.INTENT_TYPES.PAYMENT_METHOD) {
        logger.info(`User ${telegramId} asking about payment methods`);

        conversationState.clearState(telegramId);

        const entity = await getEntitySafe(client, telegramId, event);
        const paymentInfo = await paymentFlowService.getPaymentInfoResponse();

        if (paymentInfo) {
          if (entity) {
            await client.sendMessage(entity, { message: paymentInfo });
          } else {
            await event.message.reply({ message: paymentInfo });
          }
          await messageService.saveMessage(user.id, 'assistant', paymentInfo);
        }

        return;
      }

      // Handle RECOMMENDATION intent
      if (intentResult.intent === intentClassifier.INTENT_TYPES.RECOMMENDATION) {
        logger.info(`User ${telegramId} asking for recommendation`);

        const entity = await getEntitySafe(client, telegramId, event);
        const recommendationMessage = await servicesMenu.generateRecommendationResponse(pendingState.services, botConfig, ownerId);

        const typingDelay = calculateTypingDelay(recommendationMessage);
        await sleep(typingDelay);

        if (entity) {
          await client.sendMessage(entity, { message: recommendationMessage });
        } else {
          await event.message.reply({ message: recommendationMessage });
        }
        await messageService.saveMessage(user.id, 'assistant', recommendationMessage);

        logger.info(`Sent recommendation to ${telegramId}`);
        return;
      }

      // If it's a conversational message, respond naturally and redirect to menu
      if (intentResult.intent !== intentClassifier.INTENT_TYPES.SERVICE_SELECTION) {
        // Clear the pending state to allow normal conversation flow
        conversationState.clearState(telegramId);

        // Generate AI response and include menu redirect
        const history = await messageService.getConversationHistory(user.id, config.contextMessageLimit || 20);
        let replyText = await aiService.generateReply(text, history, user.id, ownerId, false, user.id);

        // Append a gentle redirect to the menu
        const redirectMessage = await servicesMenu.generateMenuRedirectMessage(botConfig, pendingState.services, ownerId);
        replyText = replyText + '\n\n' + redirectMessage;

        const entity = await getEntitySafe(client, telegramId, event);
        const typingDelay = calculateTypingDelay(replyText);
        await sleep(typingDelay);

        if (entity) {
          await client.sendMessage(entity, { message: replyText });
        } else {
          await event.message.reply({ message: replyText });
        }
        await messageService.saveMessage(user.id, 'assistant', replyText);

        logger.info(`Responded with redirect to menu for ${telegramId}`);
        return;
      }

      // If it looks like a selection attempt but invalid, ask for clarification
      const entity = await getEntitySafe(client, telegramId, event);
      const invalidSelectionMessage = await servicesMenu.generateInvalidSelectionMessage(botConfig, pendingState.services, ownerId);

      const typingDelay = calculateTypingDelay(invalidSelectionMessage);
      await sleep(typingDelay);

      if (entity) {
        await client.sendMessage(entity, { message: invalidSelectionMessage });
      } else {
        await event.message.reply({ message: invalidSelectionMessage });
      }
      await messageService.saveMessage(user.id, 'assistant', invalidSelectionMessage);

      logger.info(`Sent invalid selection response to ${telegramId}`);
      return;
    }

    // ============================================
    // DIRECT PRODUCT/KEYWORD MATCHING
    // Check if user is directly requesting a specific product they already know
    // ============================================
    const directRequestPatterns = [
      /(?:quiero|dame|info|información|informacion|ver|muéstrame|muestrame|enséñame|ensename|dame|necesito|busco)\s+(?:el\s+|la\s+|los\s+|las\s+|un\s+|una\s+)?(.+)/i,
      /(?:el\s+|la\s+|los\s+|las\s+)?(pack|video|foto|fotos|videos|sexting|llamada|call|premium|canal|contenido|packs)(?:\s+de\s+(.+))?$/i
    ];

    // Get available services for matching
    const availableServices = await servicesMenu.getAvailableServices(ownerId);
    let directServiceMatch = null;

    // Check if message contains clear intent words + product keywords
    const intentWords = ['quiero', 'dame', 'info', 'información', 'informacion', 'ver', 'muéstrame', 'muestrame', 'enséñame', 'ensename', 'necesito', 'busco', 'estoy buscando', 'me interesa', 'quisiera', 'podrías'];
    const hasIntentWord = intentWords.some(word => text.toLowerCase().includes(word));

    if (hasIntentWord) {
      // Try to match service by name/keyword
      for (const service of availableServices) {
        const serviceName = service.name.toLowerCase();
        const serviceWords = serviceName.split(/\s+/);

        // Check if any word from service name is in the message
        for (const word of serviceWords) {
          if (word.length > 3 && text.toLowerCase().includes(word)) {
            directServiceMatch = service;
            break;
          }
        }

        if (directServiceMatch) break;
      }

      // Also try getServiceBySelection for number/name matching
      if (!directServiceMatch) {
        directServiceMatch = servicesMenu.getServiceBySelection(availableServices, text);
      }
    }

    // If we found a direct match, send the product info immediately
    if (directServiceMatch) {
      logger.info(`Direct product match for ${telegramId}: ${directServiceMatch.name}`);

      const entity = await getEntitySafe(client, telegramId, event);

      // Check if product has media
      if (directServiceMatch.hasMedia) {
        // Use keyword-based matching to find the best media
        const bestMatches = await mediaService.findBestMatchingMedia(
          text,
          null,
          directServiceMatch.productId,
          ownerId
        );

        // Send top matching media (max 5, but prefer highly matched ones)
        const itemsToSend = bestMatches
          .filter(m => m.matchCount >= 2) // Only send good matches
          .slice(0, 5)
          .map(m => m.media);

        // If no good matches, send featured/recent media from the product
        if (itemsToSend.length === 0 && bestMatches.length > 0) {
          itemsToSend.push(...bestMatches.slice(0, 3).map(m => m.media));
        }

        // Fallback: get all media from product if still empty
        if (itemsToSend.length === 0) {
          let fallbackMedia = [];
          if (directServiceMatch.productId) {
            fallbackMedia = await mediaService.getAllMedia({
              ownerUserId: ownerId,
              isActive: true,
              productId: directServiceMatch.productId
            });
          }
          itemsToSend.push(...fallbackMedia.slice(0, 3));
        }

        for (const media of itemsToSend) {
          const filePath = path.join(__dirname, '../uploads', media.file_path);

          if (fs.existsSync(filePath)) {
            try {
              if (entity) {
                await client.sendFile(entity, {
                  file: filePath,
                  forceDocument: false
                });
              } else {
                await event.message.reply({ file: filePath, message: '' });
              }

              await mediaService.recordMediaView(user.id, media.id, ownerId);
              await sleep(300);
            } catch (sendError) {
              logger.error('Error sending direct match media:', sendError.message);
            }
          }
        }

        // Check if product has description
        const hasDescription = directServiceMatch.description && directServiceMatch.description.trim().length > 0;

        if (hasDescription) {
          await sleep(500);
          if (entity) {
            await client.sendMessage(entity, { message: directServiceMatch.description });
          } else {
            await event.message.reply({ message: directServiceMatch.description });
          }
          await messageService.saveMessage(user.id, 'assistant', directServiceMatch.description);
        } else if (itemsToSend.length > 0) {
          // Generate follow-up message
          await sleep(500);
          const askMessage = await servicesMenu.generateMediaFollowUpMessage(botConfig, itemsToSend.length, ownerId);
          if (entity) {
            await client.sendMessage(entity, { message: askMessage });
          } else {
            await event.message.reply({ message: askMessage });
          }
          await messageService.saveMessage(user.id, 'assistant', askMessage);
        }

        logger.info(`Direct product content sent to ${telegramId}: ${directServiceMatch.name} (${itemsToSend.length} media items)`);
        return;
      }

      // No media - send description or confirmation
      if (directServiceMatch.description && directServiceMatch.description.trim().length > 0) {
        await sleep(500);
        if (entity) {
          await client.sendMessage(entity, { message: directServiceMatch.description });
        } else {
          await event.message.reply({ message: directServiceMatch.description });
        }
        await messageService.saveMessage(user.id, 'assistant', directServiceMatch.description);
      } else {
        const confirmMessage = await servicesMenu.generateServiceConfirmationMessage(directServiceMatch, botConfig, ownerId);
        if (entity) {
          await client.sendMessage(entity, { message: confirmMessage });
        } else {
          await event.message.reply({ message: confirmMessage });
        }
        await messageService.saveMessage(user.id, 'assistant', confirmMessage);
      }

      logger.info(`Direct product info sent to ${telegramId}: ${directServiceMatch.name}`);
      return;
    }

    // Classify intent
    const intentResult = await intentClassifier.classifyIntent(text, ownerId);
    logger.info(`Intent classified: ${intentResult.intent} (confidence: ${intentResult.confidence})`);

    // Handle browse_content intent - show services menu
    if (intentResult.intent === intentClassifier.INTENT_TYPES.BROWSE_CONTENT && intentResult.confidence >= 0.6) {
      logger.info(`User ${telegramId} wants to see services, showing menu...`);

      // Get available services
      const availableServices = await servicesMenu.getAvailableServices(ownerId);

      if (availableServices.length > 0) {
        // Generate menu message
        const menuMessage = await servicesMenu.generateServicesMenuMessage(availableServices, botConfig, ownerId);

        // Send menu
        const entity = await getEntitySafe(client, telegramId, event);

        const typingDelay = calculateTypingDelay(menuMessage);
        await sleep(typingDelay);

        if (entity) {
          await client.sendMessage(entity, { message: menuMessage });
        } else {
          await event.message.reply({ message: menuMessage });
        }
        await messageService.saveMessage(user.id, 'assistant', menuMessage);

        // Set state for awaiting selection
        conversationState.setAwaitingSelection(telegramId, availableServices);

        logger.info(`Services menu sent to ${telegramId}`);
        return;
      }
    }

    // Handle interest intent - user expressed interest in content, mention payment naturally
    if (intentResult.intent === intentClassifier.INTENT_TYPES.INTEREST && intentResult.confidence >= 0.6) {
      logger.info(`User ${telegramId} expressed interest in content, asking about payment...`);

      const entity = await getEntitySafe(client, telegramId, event);
      const interestResponse = await servicesMenu.generateInterestResponse(botConfig, ownerId);

      const typingDelay = calculateTypingDelay(interestResponse);
      await sleep(typingDelay);

      if (entity) {
        await client.sendMessage(entity, { message: interestResponse });
      } else {
        await event.message.reply({ message: interestResponse });
      }
      await messageService.saveMessage(user.id, 'assistant', interestResponse);

      logger.info(`Sent interest response to ${telegramId}`);
      return;
    }

    // Check for keyword triggers (single media)
    logger.debug('Checking for media keywords...');
    const matchedMedia = await mediaService.findMediaByKeyword(text);

    // Get conversation history
    const history = await messageService.getConversationHistory(user.id, config.contextMessageLimit || 20);

    let replyText;
    let mediaSent = false;

    // Send matched keyword media
    if (matchedMedia) {
      try {
        logger.info(`Sending media: ${matchedMedia.title}`);
        const filePath = path.join(__dirname, '../uploads', matchedMedia.file_path);

        if (fs.existsSync(filePath)) {
          const entity = await getEntitySafe(client, telegramId, event);

          // Generate natural caption
          const caption = await bulkMediaService.generateNaturalCaption(matchedMedia, botConfig, ownerId);

          const typingDelay = calculateTypingDelay(caption);
          await sleep(typingDelay);

          if (entity) {
            await client.sendFile(entity, {
              file: filePath,
              caption: caption,
              forceDocument: false
            });
          } else {
            // Fallback: use message.reply
            await event.message.reply({ file: filePath, message: caption });
          }

          await mediaService.recordMediaView(user.id, matchedMedia.id, ownerId);

          logger.info(`Media sent successfully: ${matchedMedia.title}`);
          mediaSent = true;
          replyText = caption;
        } else {
          logger.error(`File not found: ${filePath}`);
        }
      } catch (mediaError) {
        logger.error('Error sending media:', mediaError.message);
      }
    }

    // If no media sent, generate AI reply
    if (!mediaSent) {
      const aiReplyText = await aiService.generateReply(text, history, user.id, ownerId, false, user.id);
      replyText = aiReplyText;

      const typingDelay = calculateTypingDelay(replyText);
      await sleep(typingDelay);

      try {
        await event.message.reply({ message: replyText });
      } catch (replyError) {
        logger.error('Error sending reply:', replyError.message);
      }
    }

    // Save bot message
    await messageService.saveMessage(user.id, 'assistant', replyText);

    // Increment daily message count for free users
    if (ownerId) {
      try {
        // Ensure ownerId is an integer
        const ownerIdInt = typeof ownerId === 'string' ? parseInt(ownerId, 10) : ownerId;

        const owner = await prisma.adminUser.findUnique({
          where: { id: ownerIdInt },
          select: { plan: true }
        });

        if (owner && owner.plan === 'free') {
          await rateLimitService.incrementDailyCount(ownerIdInt);
        }
      } catch (incrementError) {
        logger.error('Error incrementing daily count:', incrementError.message);
      }
    }

    logger.info(`Replied to ${telegramId}`);
  } catch (error) {
    logger.error('Error processing message:', error);
  }
};

/**
 * Main message handler - uses buffering to group consecutive messages
 */
const handleMessage = async (event, ownerId = null) => {
  try {
    const message = event.message;
    if (!message) return;

    // Only respond to private messages
    const peerId = message.peerId;
    const isPrivate = peerId?.className === 'PeerUser';
    if (!isPrivate) {
      logger.debug('Ignoring non-private message');
      return;
    }

    // Check credentials
    if (ownerId) {
      logger.debug(`Processing message for bot owner: ${ownerId}`);
    } else {
      const hasValidCredentials = await botInstanceService.hasValidCredentials();
      if (!hasValidCredentials) {
        logger.warn('Bot not configured - missing Telegram credentials. Ignoring message.');
        return;
      }
    }

    const client = event.client || telegramService.getClient();

    // Get sender ID
    let senderId = peerId?.userId || message.fromId?.userId;
    if (!senderId) {
      senderId = event.senderId?.value || event.chatId;
    }

    if (!senderId) {
      logger.warn('Could not determine sender ID, skipping message');
      return;
    }

    const telegramId = senderId.toString();

    // Check if user is blocked
    try {
      const isBlocked = await blockedUsersService.isBlocked(ownerId, telegramId);
      if (isBlocked) {
        logger.info(`Ignoring message from blocked user ${telegramId}`);
        return;
      }
    } catch (blockCheckError) {
      logger.error('Error checking blocked status:', blockCheckError);
    }

    // Check for photo (payment proof) - handle immediately without buffering
    const hasPhoto = message.photo && (message.photo.sizes || message.photo.length > 0);
    const text = message.message || message.text || '';

    // Get sender info
    let senderUsername = null;
    let senderFirstName = null;
    let senderLastName = null;
    let senderDisplayName = null;
    try {
      if (event.sender) {
        const sender = event.sender;
        senderUsername = sender.username || null;
        senderFirstName = sender.firstName || null;
        senderLastName = sender.lastName || null;
        senderDisplayName = senderFirstName && senderLastName
          ? `${senderFirstName} ${senderLastName}`
          : senderFirstName || senderLastName || senderUsername || null;
      } else if (event.message && event.message.fromId) {
        try {
          const sender = await client.getEntity(event.message.fromId);
          if (sender) {
            senderUsername = sender.username || null;
            senderFirstName = sender.firstName || null;
            senderLastName = sender.lastName || null;
            senderDisplayName = senderFirstName && senderLastName
              ? `${senderFirstName} ${senderLastName}`
              : senderFirstName || senderLastName || senderUsername || null;
          }
        } catch (e) {
          logger.debug('Could not fetch sender entity:', e.message);
        }
      }
    } catch (e) {
      logger.debug('Could not get sender name:', e.message);
    }

    // Create or update user
    const { user, wasReset } = await userService.findOrCreateUserWithInstance(
      telegramId,
      senderUsername,
      senderDisplayName,
      senderFirstName,
      senderLastName
    );

    if (wasReset) {
      logger.info(`User ${telegramId} was reset due to bot instance change`);
    }

    // Handle photos immediately (payment proofs) - don't buffer
    if (hasPhoto) {
      return await processMessage(telegramId, text, client, event, ownerId, {
        senderUsername,
        senderFirstName,
        senderLastName,
        senderDisplayName,
        user,
        wasReset
      });
    }

    // Check if there's already a buffer for this user
    if (messageBuffer.has(telegramId)) {
      // Add message to existing buffer
      const buffer = messageBuffer.get(telegramId);
      buffer.messages.push(text);
      logger.debug(`Buffering message ${buffer.messages.length} for ${telegramId}: "${text.substring(0, 50)}..."`);

      // Clear existing timeout and set a new one
      clearTimeout(buffer.timeout);
      buffer.timeout = setTimeout(() => {
        processBufferedMessages(telegramId, client, event, ownerId);
      }, BUFFER_WAIT_TIME);

      return;
    }

    // Create new buffer for this user
    logger.debug(`Creating new message buffer for ${telegramId}`);
    messageBuffer.set(telegramId, {
      messages: [text],
      timeout: setTimeout(() => {
        processBufferedMessages(telegramId, client, event, ownerId);
      }, BUFFER_WAIT_TIME),
      userData: {
        senderUsername,
        senderFirstName,
        senderLastName,
        senderDisplayName,
        user,
        wasReset
      }
    });

  } catch (error) {
    logger.error('Error in handleMessage:', error);
  }
};

module.exports = { handleMessage };