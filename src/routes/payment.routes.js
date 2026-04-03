const express = require('express');
const router = express.Router();
const paymentService = require('../services/payment.service');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

/**
 * GET /api/payment/config
 * Get payment configuration (SINPE number, PayPal link)
 */
router.get('/config', async (req, res) => {
  try {
    const config = await paymentService.getSINPEConfig();
    res.json({
      success: true,
      sinpe_number: config.sinpe_number,
      paypal_link: config.paypal_link,
    });
  } catch (error) {
    logger.error('Get payment config error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get payment configuration'
    });
  }
});

/**
 * GET /api/payment/proof/:filename
 * Serve payment proof image
 */
router.get('/proof/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../../uploads/proofs', filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Proof not found'
      });
    }

    res.sendFile(filePath);
  } catch (error) {
    logger.error('Serve proof error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to serve proof'
    });
  }
});

/**
 * GET /api/payment/pending
 * Get all pending payments (for admin dashboard)
 */
router.get('/pending', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const { payments, total } = await paymentService.getPendingPayments(limit, offset);
    res.json({ success: true, payments, total });
  } catch (error) {
    logger.error('Get pending payments error:', error);
    res.status(500).json({ success: false, error: 'Failed to get pending payments' });
  }
});

/**
 * GET /api/payment/all
 * Get all payments with filters
 */
router.get('/all', async (req, res) => {
  try {
    const { status } = req.query;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const { payments, total } = await paymentService.getPayments({
      status, limit, offset
    });
    res.json({ success: true, payments, total });
  } catch (error) {
    logger.error('Get payments error:', error);
    res.status(500).json({ success: false, error: 'Failed to get payments' });
  }
});

/**
 * POST /api/payment/verify
 * Verify a pending payment
 */
router.post('/verify', async (req, res) => {
  try {
    const { payment_id, notes } = req.body;
    if (!payment_id) {
      return res.status(400).json({ success: false, error: 'payment_id is required' });
    }

    const payment = await paymentService.verifyPayment(payment_id, notes);
    res.json({ success: true, payment, message: 'Payment verified' });
  } catch (error) {
    logger.error('Verify payment error:', error);
    if (error.message === 'Payment not found') {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }
    if (error.message.includes('already')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to verify payment' });
  }
});

/**
 * POST /api/payment/reject
 * Reject a pending payment
 */
router.post('/reject', async (req, res) => {
  try {
    const { payment_id, reason } = req.body;
    if (!payment_id) {
      return res.status(400).json({ success: false, error: 'payment_id is required' });
    }

    const payment = await paymentService.rejectPayment(payment_id, reason);
    res.json({ success: true, payment, message: 'Payment rejected' });
  } catch (error) {
    logger.error('Reject payment error:', error);
    if (error.message === 'Payment not found') {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }
    if (error.message.includes('already')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to reject payment' });
  }
});

/**
 * GET /api/payment/:paymentId/proofs
 * Get payment proofs for a payment
 */
router.get('/:paymentId/proofs', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const proofs = await paymentService.getPaymentProofs(paymentId);
    res.json({ success: true, proofs });
  } catch (error) {
    logger.error('Get payment proofs error:', error);
    res.status(500).json({ success: false, error: 'Failed to get proofs' });
  }
});

module.exports = router;