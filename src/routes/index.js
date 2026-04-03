const express = require('express');
const router = express.Router();
const prisma = require('../config/database');

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get all users with activity stats
router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { last_seen: 'desc' },
      select: {
        id: true,
        telegram_id: true,
        username: true,
        display_name: true,
        first_name: true,
        last_name: true,
        created_at: true,
        last_seen: true,
        last_tone: true,
        _count: { select: { messages: true } },
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1,
          select: {
            content: true,
            timestamp: true,
            role: true
          }
        }
      }
    });

    // Serialize BigInt telegram_id to string
    const serializedUsers = users.map(user => ({
      ...user,
      telegram_id: user.telegram_id.toString(),
      message_count: user._count.messages,
      last_message: user.messages[0]?.content?.substring(0, 100) || null,
      last_message_time: user.messages[0]?.timestamp || null,
      last_message_role: user.messages[0]?.role || null
    }));

    res.json(serializedUsers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user by ID
router.get('/users/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        _count: { select: { messages: true } }
      }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Serialize BigInt telegram_id to string
    const serializedUser = {
      ...user,
      telegram_id: user.telegram_id.toString(),
      message_count: user._count.messages
    };

    res.json(serializedUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user messages
router.get('/users/:id/messages', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const messages = await prisma.message.findMany({
      where: { user_id: parseInt(req.params.id) },
      orderBy: { timestamp: 'asc' },
      take: limit,
      select: {
        id: true,
        role: true,
        content: true,
        timestamp: true
      }
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get stats
router.get('/stats', async (req, res) => {
  try {
    const [totalUsers, totalMessages, activeToday] = await Promise.all([
      prisma.user.count(),
      prisma.message.count(),
      prisma.user.count({
        where: {
          last_seen: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      })
    ]);

    const messagesToday = await prisma.message.count({
      where: {
        timestamp: {
          gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    });

    res.json({
      totalUsers,
      totalMessages,
      activeToday,
      messagesToday
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get conversations (users with recent messages)
router.get('/conversations', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { last_seen: 'desc' },
      take: 20,
      select: {
        id: true,
        telegram_id: true,
        username: true,
        display_name: true,
        first_name: true,
        last_name: true,
        last_seen: true,
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1,
          select: {
            content: true,
            timestamp: true
          }
        }
      }
    });

    const conversations = users.map(user => ({
      user_id: user.id,
      telegram_id: user.telegram_id.toString(),
      username: user.username,
      display_name: user.display_name,
      first_name: user.first_name,
      last_name: user.last_name,
      last_message: user.messages[0]?.content || '',
      timestamp: user.messages[0]?.timestamp || null,
      last_seen: user.last_seen
    }));

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bot config (in-memory for demo, should use database in production)
let botConfig = {
  botPersonality: 'You are a helpful AI assistant for a Telegram chatbot. Be friendly, concise, and helpful in your responses.',
  tone: 'friendly'
};

router.get('/config', (req, res) => {
  res.json(botConfig);
});

router.post('/config', (req, res) => {
  botConfig = { ...botConfig, ...req.body };
  res.json(botConfig);
});

router.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Telegram User Bot API' });
});

module.exports = router;