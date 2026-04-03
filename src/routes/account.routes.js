const express = require('express');
const router = express.Router();
const accountService = require('../services/account.service');
const billingService = require('../services/billing.service');
const authMiddleware = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

// Apply auth middleware to all routes
router.use(authMiddleware);

// ============================================
// PROFILE ROUTES
// ============================================

/**
 * GET /api/account/profile
 * Get user profile
 */
router.get('/profile', async (req, res) => {
  try {
    const profile = await accountService.getProfile(req.user.id);
    res.json({ success: true, profile });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to get profile' });
  }
});

/**
 * PUT /api/account/profile
 * Update user profile
 */
router.put('/profile', async (req, res) => {
  try {
    const { name, username, picture } = req.body;

    const profile = await accountService.updateProfile(req.user.id, {
      name,
      username,
      picture
    });

    res.json({ success: true, profile, message: 'Profile updated successfully' });
  } catch (error) {
    logger.error('Update profile error:', error);
    if (error.message === 'Username already taken') {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

// ============================================
// SECURITY ROUTES
// ============================================

/**
 * POST /api/account/change-password
 * Change password
 */
router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters'
      });
    }

    await accountService.changePassword(req.user.id, currentPassword, newPassword);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Change password error:', error);
    if (error.message === 'Current password is incorrect') {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to change password' });
  }
});

/**
 * POST /api/account/2fa/enable
 * Enable 2FA
 */
router.post('/2fa/enable', async (req, res) => {
  try {
    const result = await accountService.enable2FA(req.user.id);
    res.json({ success: true, ...result, message: '2FA enabled successfully' });
  } catch (error) {
    logger.error('Enable 2FA error:', error);
    res.status(500).json({ success: false, error: 'Failed to enable 2FA' });
  }
});

/**
 * POST /api/account/2fa/disable
 * Disable 2FA
 */
router.post('/2fa/disable', async (req, res) => {
  try {
    await accountService.disable2FA(req.user.id);
    res.json({ success: true, message: '2FA disabled successfully' });
  } catch (error) {
    logger.error('Disable 2FA error:', error);
    res.status(500).json({ success: false, error: 'Failed to disable 2FA' });
  }
});

/**
 * GET /api/account/sessions
 * Get active sessions
 */
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await accountService.getSessions(req.user.id);
    res.json({ success: true, sessions });
  } catch (error) {
    logger.error('Get sessions error:', error);
    res.status(500).json({ success: false, error: 'Failed to get sessions' });
  }
});

/**
 * DELETE /api/account/sessions/:sessionId
 * Invalidate a specific session
 */
router.delete('/sessions/:sessionId', async (req, res) => {
  try {
    await accountService.invalidateSession(req.user.id, parseInt(req.params.sessionId));
    res.json({ success: true, message: 'Session invalidated' });
  } catch (error) {
    logger.error('Invalidate session error:', error);
    res.status(500).json({ success: false, error: 'Failed to invalidate session' });
  }
});

/**
 * POST /api/account/sessions/invalidate-others
 * Invalidate all other sessions
 */
router.post('/sessions/invalidate-others', async (req, res) => {
  try {
    await accountService.invalidateOtherSessions(req.user.id);
    res.json({ success: true, message: 'All other sessions invalidated' });
  } catch (error) {
    logger.error('Invalidate other sessions error:', error);
    res.status(500).json({ success: false, error: 'Failed to invalidate sessions' });
  }
});

/**
 * DELETE /api/account
 * Delete account
 */
router.delete('/', async (req, res) => {
  try {
    await accountService.deleteAccount(req.user.id);
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    logger.error('Delete account error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete account' });
  }
});

// ============================================
// BILLING ROUTES
// ============================================

/**
 * GET /api/account/subscription
 * Get user subscription
 */
router.get('/subscription', async (req, res) => {
  try {
    const subscription = await billingService.getSubscription(req.user.id);
    const plans = billingService.getPlans();

    res.json({ success: true, subscription, plans });
  } catch (error) {
    logger.error('Get subscription error:', error);
    res.status(500).json({ success: false, error: 'Failed to get subscription' });
  }
});

/**
 * GET /api/account/plans
 * Get available plans
 */
router.get('/plans', (req, res) => {
  const plans = billingService.getPlans();
  res.json({ success: true, plans });
});

/**
 * POST /api/account/checkout
 * Create checkout session for subscription
 */
router.post('/checkout', async (req, res) => {
  try {
    const { plan } = req.body;

    if (!['pro', 'scale'].includes(plan)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan. Choose pro or scale.'
      });
    }

    const url = await billingService.createCheckoutSession(req.user.id, plan);
    res.json({ success: true, url });
  } catch (error) {
    logger.error('Create checkout session error:', error);
    res.status(500).json({ success: false, error: 'Failed to create checkout session' });
  }
});

/**
 * POST /api/account/portal
 * Create billing portal session
 */
router.post('/portal', async (req, res) => {
  try {
    const url = await billingService.createPortalSession(req.user.id);
    res.json({ success: true, url });
  } catch (error) {
    logger.error('Create portal session error:', error);
    if (error.message === 'No Stripe customer found') {
      return res.status(400).json({
        success: false,
        error: 'No billing account found. Subscribe to a plan first.'
      });
    }
    res.status(500).json({ success: false, error: 'Failed to create portal session' });
  }
});

/**
 * GET /api/account/payment-methods
 * Get user payment methods
 */
router.get('/payment-methods', async (req, res) => {
  try {
    const methods = await billingService.getPaymentMethods(req.user.id);
    res.json({ success: true, methods });
  } catch (error) {
    logger.error('Get payment methods error:', error);
    res.status(500).json({ success: false, error: 'Failed to get payment methods' });
  }
});

/**
 * POST /api/account/payment-methods
 * Add payment method
 */
router.post('/payment-methods', async (req, res) => {
  try {
    const { paymentMethodId } = req.body;

    if (!paymentMethodId) {
      return res.status(400).json({
        success: false,
        error: 'Payment method ID is required'
      });
    }

    const method = await billingService.addPaymentMethod(req.user.id, paymentMethodId);
    res.json({ success: true, method, message: 'Payment method added successfully' });
  } catch (error) {
    logger.error('Add payment method error:', error);
    res.status(500).json({ success: false, error: 'Failed to add payment method' });
  }
});

/**
 * DELETE /api/account/payment-methods/:id
 * Remove payment method
 */
router.delete('/payment-methods/:id', async (req, res) => {
  try {
    await billingService.removePaymentMethod(req.user.id, parseInt(req.params.id));
    res.json({ success: true, message: 'Payment method removed successfully' });
  } catch (error) {
    logger.error('Remove payment method error:', error);
    if (error.message === 'Payment method not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to remove payment method' });
  }
});

/**
 * POST /api/account/payment-methods/:id/default
 * Set default payment method
 */
router.post('/payment-methods/:id/default', async (req, res) => {
  try {
    await billingService.setDefaultPaymentMethod(req.user.id, parseInt(req.params.id));
    res.json({ success: true, message: 'Default payment method updated' });
  } catch (error) {
    logger.error('Set default payment method error:', error);
    if (error.message === 'Payment method not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to set default payment method' });
  }
});

/**
 * GET /api/account/invoices
 * Get invoices
 */
router.get('/invoices', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const invoices = await billingService.getInvoices(req.user.id, limit);
    res.json({ success: true, invoices });
  } catch (error) {
    logger.error('Get invoices error:', error);
    res.status(500).json({ success: false, error: 'Failed to get invoices' });
  }
});

/**
 * POST /api/account/limit-check
 * Check if user can perform action
 */
router.post('/limit-check', async (req, res) => {
  try {
    const { resource } = req.body;

    if (!['bots', 'messagesPerMonth', 'mediaFiles'].includes(resource)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid resource'
      });
    }

    const result = await billingService.checkLimit(req.user.id, resource);
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Limit check error:', error);
    res.status(500).json({ success: false, error: 'Failed to check limit' });
  }
});

// ============================================
// STRIPE WEBHOOK (no auth required)
// ============================================

/**
 * POST /api/account/webhook
 * Handle Stripe webhook
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (error) {
    logger.error('Webhook signature verification failed:', error);
    return res.status(400).json({ success: false, error: 'Invalid signature' });
  }

  try {
    await billingService.handleWebhookEvent(event);
    res.json({ success: true });
  } catch (error) {
    logger.error('Webhook handler error:', error);
    res.status(500).json({ success: false, error: 'Webhook handler failed' });
  }
});

module.exports = router;