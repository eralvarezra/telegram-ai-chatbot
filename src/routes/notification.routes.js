const express = require('express');
const router = express.Router();
const notificationService = require('../services/notification.service');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to extract user ID from JWT token
const getUserId = (req) => {
  // Try Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      return decoded.id;
    } catch (error) {
      return null;
    }
  }

  // Fallback to query parameter for SSE (EventSource doesn't support custom headers)
  const tokenFromQuery = req.query.token;
  if (tokenFromQuery) {
    try {
      const decoded = jwt.verify(tokenFromQuery, JWT_SECRET);
      return decoded.id;
    } catch (error) {
      return null;
    }
  }

  return null;
};

// Middleware to require authentication
const requireAuth = (req, res, next) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  req.userId = userId;
  next();
};

/**
 * GET /api/notifications
 * Get notifications for the authenticated user
 * Query params:
 *  - limit: number (default 50)
 *  - offset: number (default 0)
 *  - unreadOnly: boolean
 *  - types: comma-separated types
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { limit = 50, offset = 0, unreadOnly, types, priority } = req.query;

    const result = await notificationService.getUserNotifications(req.userId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      unreadOnly: unreadOnly === 'true',
      types: types ? types.split(',') : undefined,
      priority
    });

    res.json(result);
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

/**
 * GET /api/notifications/unread-count
 * Get unread notification count
 */
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const count = await notificationService.getUnreadCount(req.userId);
    res.json({ count });
  } catch (error) {
    logger.error('Error getting unread count:', error);
    res.status(500).json({ error: 'Error al obtener contador' });
  }
});

/**
 * GET /api/notifications/stream
 * SSE endpoint for real-time notifications
 */
router.get('/stream', requireAuth, (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  // Add client to SSE
  notificationService.addSSEClient(req.userId, res);

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (e) {
      clearInterval(heartbeat);
      notificationService.removeSSEClient(req.userId, res);
    }
  }, 30000);

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    notificationService.removeSSEClient(req.userId, res);
  });
});

/**
 * POST /api/notifications
 * Create a notification (internal use)
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { type, title, message, action_url, action_text, priority, metadata, expires_at } = req.body;

    if (!type || !title || !message) {
      return res.status(400).json({ error: 'Type, title and message are required' });
    }

    const notification = await notificationService.createNotification({
      user_id: req.userId,
      type,
      title,
      message,
      action_url,
      action_text,
      priority,
      metadata,
      expires_at: expires_at ? new Date(expires_at) : undefined
    });

    if (!notification) {
      return res.status(429).json({ error: 'Rate limited' });
    }

    res.status(201).json(notification);
  } catch (error) {
    logger.error('Error creating notification:', error);
    res.status(500).json({ error: 'Error al crear notificación' });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark a notification as read
 */
router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    const notification = await notificationService.markAsRead(notificationId, req.userId);

    res.json(notification);
  } catch (error) {
    if (error.message === 'Notification not found') {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }
    logger.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Error al marcar notificación' });
  }
});

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put('/read-all', requireAuth, async (req, res) => {
  try {
    const count = await notificationService.markAllAsRead(req.userId);
    res.json({ message: `${count} notificaciones marcadas como leídas`, count });
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Error al marcar notificaciones' });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    const deleted = await notificationService.deleteNotification(notificationId, req.userId);

    if (!deleted) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    res.json({ message: 'Notificación eliminada' });
  } catch (error) {
    logger.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Error al eliminar notificación' });
  }
});

/**
 * DELETE /api/notifications
 * Clear all notifications
 */
router.delete('/', requireAuth, async (req, res) => {
  try {
    const count = await notificationService.clearAllNotifications(req.userId);
    res.json({ message: `${count} notificaciones eliminadas`, count });
  } catch (error) {
    logger.error('Error clearing notifications:', error);
    res.status(500).json({ error: 'Error al limpiar notificaciones' });
  }
});

module.exports = router;