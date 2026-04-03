const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const setupService = require('../services/setup.service');

// Get setup status
router.get('/status', async (req, res) => {
  try {
    const status = await setupService.getSetupStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check if needs onboarding
router.get('/needs-onboarding', async (req, res) => {
  try {
    const status = await setupService.getSetupStatus();
    res.json({
      needsOnboarding: !status.isComplete,
      currentStep: status.currentStep,
      needsTelegram: status.needsTelegram,
      needsAI: status.needsAI
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save Telegram credentials
router.post('/telegram/credentials', async (req, res) => {
  try {
    const { apiId, apiHash, phone } = req.body;

    if (!apiId || !apiHash || !phone) {
      return res.status(400).json({ error: 'API ID, API Hash, and phone are required' });
    }

    const setup = await setupService.saveTelegramCredentials(apiId, apiHash, phone);
    res.json({ success: true, nextStep: 'ai' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save Telegram session
router.post('/telegram/session', async (req, res) => {
  try {
    const { session } = req.body;

    if (!session) {
      return res.status(400).json({ error: 'Session string is required' });
    }

    const setup = await setupService.saveTelegramSession(session);
    res.json({ success: true, message: 'Telegram connected successfully!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save AI credentials
router.post('/ai/credentials', async (req, res) => {
  try {
    const { apiKey, provider } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    const setup = await setupService.saveAICredentials(apiKey, provider || 'groq');
    res.json({ success: true, nextStep: 'config' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Complete setup
router.post('/complete', async (req, res) => {
  try {
    await prisma.appSetup.update({
      where: { id: 1 },
      data: { setup_completed: true, current_step: 'complete' }
    });
    res.json({ success: true, message: 'Setup completed!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset setup (GET for easy browser access)
router.get('/reset', async (req, res) => {
  try {
    await prisma.appSetup.deleteMany({});
    await prisma.botConfig.deleteMany({});
    res.json({ success: true, message: 'Setup reset! Go to http://localhost:3001 to start onboarding.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset setup (POST)
router.post('/reset', async (req, res) => {
  try {
    await prisma.appSetup.deleteMany({});
    await prisma.botConfig.deleteMany({});
    res.json({ success: true, message: 'Setup reset! Go to http://localhost:3001 to start onboarding.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get credentials status
router.get('/credentials/status', async (req, res) => {
  try {
    const status = await setupService.getCredentialsStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unlink Telegram
router.delete('/telegram/unlink', async (req, res) => {
  try {
    await setupService.clearTelegramCredentials();
    res.json({ success: true, message: 'Telegram desvinculado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unlink AI/Groq
router.delete('/ai/unlink', async (req, res) => {
  try {
    await setupService.clearAICredentials();
    res.json({ success: true, message: 'API de IA desvinculada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;