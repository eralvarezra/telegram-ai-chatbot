const express = require('express');
const router = express.Router();
const configService = require('../services/config.service');

// Get bot config
router.get('/bot-config', async (req, res) => {
  try {
    const config = await configService.getConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update bot config
router.put('/bot-config', async (req, res) => {
  try {
    const config = await configService.updateConfig(req.body);
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get personality config
router.get('/personality', async (req, res) => {
  try {
    const config = await configService.getPersonalityConfig();
    res.json(config);
  } catch (error) {
    console.error('Error fetching personality config:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Update personality config
router.post('/personality', async (req, res) => {
  try {
    const config = await configService.updatePersonalityConfig(req.body);
    res.json(config);
  } catch (error) {
    console.error('Error updating personality config:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

module.exports = router;