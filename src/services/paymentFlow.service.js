const prisma = require('../config/database');
const configService = require('./config.service');
const paymentMethodService = require('./paymentMethod.service');
const logger = require('../utils/logger');

// Helper to convert BigInt fields to strings for JSON serialization
const serializePayment = (payment) => {
  if (!payment) return null;
  return {
    ...payment,
    user_id: payment.user_id?.toString() || payment.user_id,
  };
};

// Keywords that indicate EXPLICIT payment intent (user wants to pay NOW)
// These keywords should trigger payment flow only when user is ready to pay
const PAYMENT_INTENT_KEYWORDS = [
  // Payment method inquiries
  'cómo pago', 'como pago', 'cómo pagar', 'como pagar',
  'dónde deposito', 'donde deposito', 'dónde pago', 'donde pago',
  'tienes paypal', 'tienes sinpe', 'aceptas paypal', 'aceptas sinpe',
  'método de pago', 'metodo de pago', 'métodos de pago', 'metodos de pago',
  'how do i pay', 'how to pay', 'payment method', 'payment methods',
  'do you have paypal', 'do you accept paypal',
  // Payment confirmation intent
  'ya pagué', 'ya pague', 'pagué', 'pague', 'hice el pago', 'transferí', 'transferi',
  'envié el dinero', 'envie el dinero', 'el pago está hecho', 'el pago esta hecho',
  'i paid', 'payment sent', 'money sent',
  // Proof/payment method mentions
  'ya te envié', 'ya te envie', 'aquí está el comprobante', 'aqui está el comprobante',
  'aquí el comprobante', 'aqui el comprobante', 'te mandé el comprobante', 'te mando el comprobante'
];

// Check if message is asking about payment (EXPLICIT intent to pay)
const isPaymentQuestion = (text) => {
  const lowerText = text.toLowerCase().trim();

  // Only match EXPLICIT payment intent keywords
  // This means user is actively trying to pay or asking how to pay
  return PAYMENT_INTENT_KEYWORDS.some(keyword => lowerText.includes(keyword));
};

// Get payment info response
const getPaymentInfoResponse = async () => {
  // Use the new payment methods system
  return await paymentMethodService.getPaymentInfoText();
};

// Notify admin about user requesting manual payment info
const notifyManualPaymentRequest = async (ownerId, telegramId) => {
  try {
    const notificationService = require('./notification.service');

    if (!ownerId) {
      logger.debug('No owner ID provided, skipping manual payment notification');
      return;
    }

    // Ensure ownerId is an integer
    const ownerIdInt = typeof ownerId === 'string' ? parseInt(ownerId, 10) : ownerId;

    // Get user info for context
    const user = await prisma.user.findUnique({
      where: { telegram_id: BigInt(telegramId) },
      select: { username: true }
    });

    const username = user?.username || 'Usuario';

    // Create notification for the bot owner
    await notificationService.createNotification({
      user_id: ownerIdInt,
      type: 'payment',
      title: 'Usuario solicita métodos de pago',
      message: `${username} está preguntando por métodos de pago. Responde manualmente.`,
      priority: 'high',
      action_url: '/conversations',
      action_text: 'Ver conversación',
      skipRateLimit: true
    });

    logger.info(`Notified owner ${ownerIdInt} about manual payment request from ${username}`);
  } catch (error) {
    logger.error('Error notifying owner about manual payment request:', error);
  }
};

// Check if should use manual payment response
const shouldUseManualPaymentResponse = async () => {
  return await paymentMethodService.hasOnlyManualPayment();
};

// Get manual payment response
const getManualPaymentResponse = () => {
  return 'Dame un momento y ya te comparto los métodos de pago 💕';
};

// Notify bot owner about new payment
const notifyOwnerAboutPayment = async (ownerId, telegramId, paymentId, isNew) => {
  try {
    // Import notification service
    const notificationService = require('./notification.service');

    if (!ownerId) {
      logger.debug('No owner ID provided, skipping notification');
      return;
    }

    // Ensure ownerId is an integer
    const ownerIdInt = typeof ownerId === 'string' ? parseInt(ownerId, 10) : ownerId;

    // Get user info for context
    const user = await prisma.user.findUnique({
      where: { telegram_id: BigInt(telegramId) },
      select: { username: true }
    });

    const username = user?.username || 'Usuario';

    // Create notification for the bot owner
    await notificationService.createNotification({
      user_id: ownerIdInt,
      type: 'payment',
      title: isNew ? 'Nuevo pago recibido' : 'Comprobante actualizado',
      message: isNew
        ? `${username} ha enviado un nuevo comprobante de pago`
        : `${username} ha actualizado su comprobante de pago`,
      priority: 'high',
      action_url: '/payments',
      action_text: 'Ver pagos',
      skipRateLimit: true
    });

    logger.info(`Notified owner ${ownerIdInt} about payment ${paymentId}`);
  } catch (error) {
    logger.error('Error notifying owner about payment:', error);
    // Don't throw - notification failure shouldn't break payment flow
  }
};

// Create pending payment from Telegram
const createPendingPayment = async (telegramId, paymentMethod = 'sinpe', photoPath = null, ownerId = null) => {
  // Find or create user
  let user = await prisma.user.findUnique({
    where: { telegram_id: BigInt(telegramId) }
  });

  if (!user) {
    user = await prisma.user.create({
      data: { telegram_id: BigInt(telegramId) }
    });
  }

  // Check for existing pending payment
  const existingPending = await prisma.payment.findFirst({
    where: {
      user_id: user.id,
      status: 'pending'
    }
  });

  if (existingPending) {
    // Add proof to existing payment
    if (photoPath) {
      await prisma.paymentProof.create({
        data: {
          payment_id: existingPending.id,
          file_path: photoPath,
          uploaded_at: new Date()
        }
      });
    }

    // Notify bot owner about updated payment
    notifyOwnerAboutPayment(ownerId, telegramId, existingPending.id, false);

    return { payment: serializePayment(existingPending), isNew: false };
  }

  // Create new payment
  const payment = await prisma.payment.create({
    data: {
      user_id: user.id,
      payment_method: paymentMethod,
      status: 'pending',
    }
  });

  // Save proof if provided
  if (photoPath) {
    await prisma.paymentProof.create({
      data: {
        payment_id: payment.id,
        file_path: photoPath,
        uploaded_at: new Date()
      }
    });
  }

  logger.info(`Created pending payment ${payment.id} for user ${telegramId}`);

  // Notify bot owner about new payment
  notifyOwnerAboutPayment(ownerId, telegramId, payment.id, true);

  return { payment: serializePayment(payment), isNew: true };
};

// Get user's pending payments
const getUserPendingPayments = async (telegramId) => {
  const user = await prisma.user.findUnique({
    where: { telegram_id: BigInt(telegramId) },
    include: {
      payments: {
        where: { status: 'pending' },
        orderBy: { created_at: 'desc' }
      }
    }
  });

  if (!user) return [];

  return user.payments.map(serializePayment);
};

// Get response for photo received
const getPhotoReceivedResponse = async (paymentMethod = 'sinpe') => {
  const config = await configService.getConfig();

  // Use custom message if configured, otherwise use default
  if (config.payment_confirm_message) {
    return config.payment_confirm_message;
  }

  return `📸 ¡Recibí tu comprobante!

✅ Voy a verificarlo, muchas gracias por tu compra! 💕

Te aviso en cuanto esté listo.`;
};

// Add payment proof to existing payment
const addPaymentProof = async (paymentId, photoPath) => {
  const proof = await prisma.paymentProof.create({
    data: {
      payment_id: paymentId,
      file_path: photoPath,
      uploaded_at: new Date()
    }
  });
  logger.info(`Added payment proof ${proof.id} to payment ${paymentId}`);
  return proof;
};

module.exports = {
  isPaymentQuestion,
  getPaymentInfoResponse,
  createPendingPayment,
  getUserPendingPayments,
  getPhotoReceivedResponse,
  addPaymentProof,
  notifyManualPaymentRequest,
  shouldUseManualPaymentResponse,
  getManualPaymentResponse,
};