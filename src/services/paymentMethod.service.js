const prisma = require('../config/database');
const { PAYMENT_METHODS, PAYMENT_CATEGORIES, getMethodById } = require('../constants/paymentMethods');
const logger = require('../utils/logger');

/**
 * Get all available payment method definitions
 */
const getAvailableMethods = () => {
  return PAYMENT_METHODS;
};

/**
 * Get payment categories
 */
const getCategories = () => {
  return PAYMENT_CATEGORIES;
};

/**
 * Get configured payment methods for the bot
 */
const getConfiguredMethods = async () => {
  try {
    const methods = await prisma.paymentMethodConfig.findMany({
      where: { is_active: true },
      orderBy: { display_order: 'asc' }
    });

    // Enrich with method details
    return methods.map(m => {
      const methodInfo = getMethodById(m.method_type);
      return {
        ...m,
        name: methodInfo?.name || m.method_type,
        icon: methodInfo?.icon || '💳',
        description: methodInfo?.description || '',
        is_manual: methodInfo?.is_manual || false
      };
    });
  } catch (error) {
    logger.error('Error getting configured payment methods:', error);
    return [];
  }
};

/**
 * Get all payment method configurations (active and inactive)
 */
const getAllMethodConfigs = async () => {
  try {
    const methods = await prisma.paymentMethodConfig.findMany({
      orderBy: { display_order: 'asc' }
    });

    return methods.map(m => {
      const methodInfo = getMethodById(m.method_type);
      return {
        ...m,
        name: methodInfo?.name || m.method_type,
        icon: methodInfo?.icon || '💳',
        description: methodInfo?.description || '',
        is_manual: methodInfo?.is_manual || false
      };
    });
  } catch (error) {
    logger.error('Error getting all payment method configs:', error);
    return [];
  }
};

/**
 * Add a new payment method configuration
 */
const addPaymentMethod = async (methodType, accountIdentifier, displayOrder = 0) => {
  // Validate method type
  const methodInfo = getMethodById(methodType);
  if (!methodInfo) {
    throw new Error(`Invalid payment method: ${methodType}`);
  }

  // Check if already configured
  const existing = await prisma.paymentMethodConfig.findFirst({
    where: { method_type: methodType }
  });

  if (existing) {
    // Update existing
    const updated = await prisma.paymentMethodConfig.update({
      where: { id: existing.id },
      data: {
        account_identifier: accountIdentifier,
        is_active: true,
        display_order: displayOrder
      }
    });
    logger.info(`Updated payment method: ${methodType}`);
    return updated;
  }

  // Create new
  const method = await prisma.paymentMethodConfig.create({
    data: {
      method_type: methodType,
      account_identifier: accountIdentifier,
      is_active: true,
      display_order: displayOrder
    }
  });

  logger.info(`Added payment method: ${methodType}`);
  return method;
};

/**
 * Update a payment method configuration
 */
const updatePaymentMethod = async (id, data) => {
  const { account_identifier, is_active, display_order } = data;

  const updateData = {};
  if (account_identifier !== undefined) updateData.account_identifier = account_identifier;
  if (is_active !== undefined) updateData.is_active = is_active;
  if (display_order !== undefined) updateData.display_order = display_order;

  const method = await prisma.paymentMethodConfig.update({
    where: { id: parseInt(id) },
    data: updateData
  });

  logger.info(`Updated payment method ${id}`);
  return method;
};

/**
 * Delete a payment method configuration
 */
const deletePaymentMethod = async (id) => {
  await prisma.paymentMethodConfig.delete({
    where: { id: parseInt(id) }
  });

  logger.info(`Deleted payment method ${id}`);
  return true;
};

/**
 * Toggle payment method active status
 */
const togglePaymentMethod = async (id) => {
  const method = await prisma.paymentMethodConfig.findUnique({
    where: { id: parseInt(id) }
  });

  if (!method) {
    throw new Error('Payment method not found');
  }

  const updated = await prisma.paymentMethodConfig.update({
    where: { id: parseInt(id) },
    data: { is_active: !method.is_active }
  });

  logger.info(`Toggled payment method ${id} to ${updated.is_active}`);
  return updated;
};

/**
 * Get payment info text for Telegram bot
 * Returns only configured payment methods without template
 */
const getPaymentInfoText = async () => {
  const methods = await getConfiguredMethods();

  if (methods.length === 0) {
    return null; // No methods configured
  }

  const activeMethods = methods.filter(m => m.is_active && !m.is_manual);

  if (activeMethods.length === 0) {
    return null; // Only manual methods configured
  }

  // Build response with only configured payment methods
  let response = '💰 **Métodos de Pago**\n\n';

  activeMethods.forEach(method => {
    response += `${method.icon} **${method.name}**\n`;
    response += `${method.account_identifier}\n\n`;
  });

  return response;
};

/**
 * Check if only manual payment is configured
 */
const hasOnlyManualPayment = async () => {
  const methods = await getConfiguredMethods();
  const activeMethods = methods.filter(m => m.is_active);

  if (activeMethods.length === 0) return false;

  // Check if all active methods are manual
  return activeMethods.every(m => m.is_manual);
};

/**
 * Check if there's a manual payment method configured
 */
const hasManualPaymentMethod = async () => {
  const methods = await getConfiguredMethods();
  return methods.some(m => m.is_active && m.is_manual);
};

/**
 * Check if a specific payment method is configured
 */
const hasPaymentMethodConfigured = async (methodType) => {
  const method = await prisma.paymentMethodConfig.findFirst({
    where: { method_type: methodType, is_active: true }
  });
  return !!method;
};

module.exports = {
  getAvailableMethods,
  getCategories,
  getConfiguredMethods,
  getAllMethodConfigs,
  addPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  togglePaymentMethod,
  getPaymentInfoText,
  hasPaymentMethodConfigured,
  hasOnlyManualPayment,
  hasManualPaymentMethod
};