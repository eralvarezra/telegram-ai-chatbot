const express = require('express');
const router = express.Router();
const paymentMethodService = require('../services/paymentMethod.service');
const logger = require('../utils/logger');

/**
 * GET /api/payment-methods/available
 * Get all available payment method definitions
 */
router.get('/available', async (req, res) => {
  try {
    const methods = paymentMethodService.getAvailableMethods();
    const categories = paymentMethodService.getCategories();
    res.json({ success: true, methods, categories });
  } catch (error) {
    logger.error('Get available payment methods error:', error);
    res.status(500).json({ success: false, error: 'Failed to get payment methods' });
  }
});

/**
 * GET /api/payment-methods/configured
 * Get configured payment methods (active only)
 */
router.get('/configured', async (req, res) => {
  try {
    const methods = await paymentMethodService.getConfiguredMethods();
    res.json({ success: true, methods });
  } catch (error) {
    logger.error('Get configured payment methods error:', error);
    res.status(500).json({ success: false, error: 'Failed to get configured methods' });
  }
});

/**
 * GET /api/payment-methods/all
 * Get all payment method configurations (including inactive)
 */
router.get('/all', async (req, res) => {
  try {
    const methods = await paymentMethodService.getAllMethodConfigs();
    res.json({ success: true, methods });
  } catch (error) {
    logger.error('Get all payment method configs error:', error);
    res.status(500).json({ success: false, error: 'Failed to get payment method configs' });
  }
});

/**
 * POST /api/payment-methods
 * Add a new payment method configuration
 */
router.post('/', async (req, res) => {
  try {
    const { method_type, account_identifier, display_order } = req.body;

    if (!method_type) {
      return res.status(400).json({ success: false, error: 'method_type is required' });
    }

    if (!account_identifier) {
      return res.status(400).json({ success: false, error: 'account_identifier is required' });
    }

    const method = await paymentMethodService.addPaymentMethod(
      method_type,
      account_identifier,
      display_order || 0
    );

    res.json({ success: true, method, message: 'Payment method added' });
  } catch (error) {
    logger.error('Add payment method error:', error);
    if (error.message.includes('Invalid payment method')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to add payment method' });
  }
});

/**
 * PUT /api/payment-methods/:id
 * Update a payment method configuration
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { account_identifier, is_active, display_order } = req.body;

    const method = await paymentMethodService.updatePaymentMethod(id, {
      account_identifier,
      is_active,
      display_order
    });

    res.json({ success: true, method, message: 'Payment method updated' });
  } catch (error) {
    logger.error('Update payment method error:', error);
    res.status(500).json({ success: false, error: 'Failed to update payment method' });
  }
});

/**
 * DELETE /api/payment-methods/:id
 * Delete a payment method configuration
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await paymentMethodService.deletePaymentMethod(id);
    res.json({ success: true, message: 'Payment method deleted' });
  } catch (error) {
    logger.error('Delete payment method error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete payment method' });
  }
});

/**
 * POST /api/payment-methods/:id/toggle
 * Toggle payment method active status
 */
router.post('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const method = await paymentMethodService.togglePaymentMethod(id);
    res.json({ success: true, method, message: 'Payment method toggled' });
  } catch (error) {
    logger.error('Toggle payment method error:', error);
    if (error.message === 'Payment method not found') {
      return res.status(404).json({ success: false, error: 'Payment method not found' });
    }
    res.status(500).json({ success: false, error: 'Failed to toggle payment method' });
  }
});

/**
 * GET /api/payment-methods/info-text
 * Get payment info text for Telegram bot
 */
router.get('/info-text', async (req, res) => {
  try {
    const text = await paymentMethodService.getPaymentInfoText();
    res.json({ success: true, text });
  } catch (error) {
    logger.error('Get payment info text error:', error);
    res.status(500).json({ success: false, error: 'Failed to get payment info text' });
  }
});

module.exports = router;