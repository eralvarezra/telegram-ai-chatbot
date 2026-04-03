const prisma = require('../config/database');
const logger = require('../utils/logger');

// Helper to convert BigInt fields to strings for JSON serialization
const serializePayment = (payment) => {
  if (!payment) return null;
  const serialized = { ...payment };
  if (serialized.user_id) serialized.user_id = serialized.user_id.toString();
  if (serialized.user && serialized.user.telegram_id) {
    serialized.user.telegram_id = serialized.user.telegram_id.toString();
  }
  return serialized;
};

/**
 * Create a new payment record
 * @param {object} data
 * @param {number} data.telegramId - User's Telegram ID
 * @param {string} data.pack_name - Pack name
 * @param {string} data.payment_method - 'sinpe' or 'paypal'
 * @param {string} data.photoPath - Path to proof photo (optional)
 * @returns {Promise<object>}
 */
const createPayment = async (data) => {
  const { telegramId, pack_name, payment_method = 'sinpe', photoPath = null } = data;

  logger.info(`Creating payment: telegramId=${telegramId}, pack=${pack_name}, method=${payment_method}`);

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
    return { payment: serializePayment(existingPending), isNew: false };
  }

  // Create new payment
  const payment = await prisma.payment.create({
    data: {
      user_id: user.id,
      pack_name,
      payment_method,
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

  logger.info(`Payment created: ${payment.id} for user ${telegramId}`);

  return { payment: serializePayment(payment), isNew: true };
};

/**
 * Verify a payment (mark as verified)
 * @param {number} paymentId
 * @param {string} notes - Optional notes
 * @returns {Promise<object>}
 */
const verifyPayment = async (paymentId, notes = null) => {
  const payment = await prisma.payment.findUnique({
    where: { id: parseInt(paymentId) }
  });

  if (!payment) {
    throw new Error('Payment not found');
  }

  if (payment.status !== 'pending') {
    throw new Error(`Payment already ${payment.status}`);
  }

  const updatedPayment = await prisma.payment.update({
    where: { id: parseInt(paymentId) },
    data: {
      status: 'verified',
      verified_at: new Date(),
      notes,
    }
  });

  logger.info(`Payment verified: ${paymentId}`);

  return serializePayment(updatedPayment);
};

/**
 * Reject a payment
 * @param {number} paymentId
 * @param {string} reason - Rejection reason
 * @returns {Promise<object>}
 */
const rejectPayment = async (paymentId, reason = null) => {
  const payment = await prisma.payment.findUnique({
    where: { id: parseInt(paymentId) }
  });

  if (!payment) {
    throw new Error('Payment not found');
  }

  if (payment.status !== 'pending') {
    throw new Error(`Payment already ${payment.status}`);
  }

  const updatedPayment = await prisma.payment.update({
    where: { id: parseInt(paymentId) },
    data: {
      status: 'rejected',
      verified_at: new Date(),
      notes: reason,
    }
  });

  logger.info(`Payment rejected: ${paymentId}, reason: ${reason}`);

  return serializePayment(updatedPayment);
};

/**
 * Get pending payments (for admin dashboard)
 * @param {number} limit
 * @param {number} offset
 * @returns {Promise<object>}
 */
const getPendingPayments = async (limit = 50, offset = 0) => {
  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where: { status: 'pending' },
      include: {
        user: {
          select: {
            id: true,
            telegram_id: true,
            username: true,
          }
        },
        proofs: {
          orderBy: { uploaded_at: 'desc' }
        }
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.payment.count({ where: { status: 'pending' } })
  ]);

  return { payments: payments.map(serializePayment), total };
};

/**
 * Get all payments with filters
 * @param {object} filters
 * @returns {Promise<object>}
 */
const getPayments = async (filters = {}) => {
  const { status, limit = 50, offset = 0 } = filters;

  const where = {};
  if (status) where.status = status;

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            telegram_id: true,
            username: true,
          }
        },
        proofs: {
          orderBy: { uploaded_at: 'desc' }
        }
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.payment.count({ where })
  ]);

  return { payments: payments.map(serializePayment), total };
};

/**
 * Get payment proofs
 * @param {number} paymentId
 * @returns {Promise<Array>}
 */
const getPaymentProofs = async (paymentId) => {
  const proofs = await prisma.paymentProof.findMany({
    where: { payment_id: parseInt(paymentId) },
    orderBy: { uploaded_at: 'desc' }
  });

  return proofs.map(proof => ({
    ...proof,
    url: `/api/payment/proof/${proof.file_path.split('/').pop()}`
  }));
};

/**
 * Get SINPE configuration
 * @returns {Promise<object>}
 */
const getSINPEConfig = async () => {
  const config = await prisma.botConfig.findUnique({ where: { id: 1 } });
  return {
    sinpe_number: config?.sinpe_number || '61714036',
    paypal_link: config?.paypal_link,
  };
};

/**
 * Add payment proof
 * @param {number} paymentId
 * @param {string} photoPath
 * @returns {Promise<object>}
 */
const addPaymentProof = async (paymentId, photoPath) => {
  const proof = await prisma.paymentProof.create({
    data: {
      payment_id: parseInt(paymentId),
      file_path: photoPath,
      uploaded_at: new Date()
    }
  });
  logger.info(`Added payment proof ${proof.id} to payment ${paymentId}`);
  return proof;
};

module.exports = {
  createPayment,
  verifyPayment,
  rejectPayment,
  getPendingPayments,
  getPayments,
  getPaymentProofs,
  getSINPEConfig,
  addPaymentProof,
};