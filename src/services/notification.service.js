const prisma = require('../config/database');
const logger = require('../utils/logger');

// Notification types
const NOTIFICATION_TYPES = {
  PAYMENT: 'payment',
  WARNING: 'warning',
  SUGGESTION: 'suggestion',
  INFO: 'info'
};

// Priority levels
const PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
};

// Rate limiting - prevent notification spam
// Key: userId_type, Value: timestamp of last notification
const notificationCooldowns = new Map();
const COOLDOWN_PERIODS = {
  [NOTIFICATION_TYPES.PAYMENT]: 0, // No cooldown for payments
  [NOTIFICATION_TYPES.WARNING]: 60 * 60 * 1000, // 1 hour
  [NOTIFICATION_TYPES.SUGGESTION]: 24 * 60 * 60 * 1000, // 24 hours
  [NOTIFICATION_TYPES.INFO]: 60 * 60 * 1000 // 1 hour
};

/**
 * Check if notification should be rate-limited
 */
const isRateLimited = (userId, type) => {
  const key = `${userId}_${type}`;
  const lastNotification = notificationCooldowns.get(key);
  const cooldown = COOLDOWN_PERIODS[type] || 0;

  if (lastNotification && Date.now() - lastNotification < cooldown) {
    return true;
  }

  notificationCooldowns.set(key, Date.now());
  return false;
};

/**
 * Create a notification
 * @param {Object} data - Notification data
 * @param {number} data.user_id - User ID (AdminUser)
 * @param {string} data.type - Notification type
 * @param {string} data.title - Title
 * @param {string} data.message - Message
 * @param {string} [data.action_url] - Optional action URL
 * @param {string} [data.action_text] - Optional action button text
 * @param {string} [data.priority] - Priority level
 * @param {object} [data.metadata] - Additional metadata
 * @param {Date} [data.expires_at] - Expiration date
 * @returns {Promise<Object>}
 */
const createNotification = async (data) => {
  try {
    const {
      user_id,
      type,
      title,
      message,
      action_url,
      action_text,
      priority = PRIORITY.MEDIUM,
      metadata,
      expires_at,
      skipRateLimit = false
    } = data;

    // Ensure user_id is an integer
    const userIdInt = typeof user_id === 'string' ? parseInt(user_id, 10) : user_id;

    // Check rate limiting (skip for payments)
    if (!skipRateLimit && isRateLimited(userIdInt, type)) {
      logger.debug(`Notification rate limited for user ${userIdInt}, type: ${type}`);
      return null;
    }

    const notification = await prisma.notification.create({
      data: {
        user_id: userIdInt,
        type,
        title,
        message,
        action_url,
        action_text,
        priority,
        metadata: metadata ? JSON.stringify(metadata) : null,
        expires_at
      }
    });

    logger.info(`Created notification ${notification.id} for user ${userIdInt}: ${title}`);

    // Emit real-time notification via SSE
    emitNotification(userIdInt, notification);

    return notification;
  } catch (error) {
    logger.error('Error creating notification:', error);
    throw error;
  }
};

/**
 * Get notifications for a user
 * @param {number} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>}
 */
const getUserNotifications = async (userId, options = {}) => {
  // Ensure userId is an integer
  const userIdInt = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  try {
    const {
      limit = 50,
      offset = 0,
      unreadOnly = false,
      types,
      priority
    } = options;

    const where = {
      user_id: userIdInt,
      OR: [
        { expires_at: null },
        { expires_at: { gte: new Date() } }
      ]
    };

    if (unreadOnly) {
      where.is_read = false;
    }

    if (types && Array.isArray(types)) {
      where.type = { in: types };
    }

    if (priority) {
      where.priority = priority;
    }

    const [notifications, unreadCount, totalCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: [
          { is_read: 'asc' },
          { created_at: 'desc' }
        ],
        take: limit,
        skip: offset
      }),
      prisma.notification.count({
        where: { user_id: userIdInt, is_read: false }
      }),
      prisma.notification.count({ where })
    ]);

    // Group notifications by date
    const grouped = groupNotificationsByDate(notifications);

    return {
      notifications: notifications.map(serializeNotification),
      grouped,
      unreadCount,
      totalCount,
      hasMore: offset + limit < totalCount
    };
  } catch (error) {
    logger.error('Error getting notifications:', error);
    throw error;
  }
};

/**
 * Mark notification as read
 * @param {number} notificationId - Notification ID
 * @param {number} userId - User ID (for authorization)
 * @returns {Promise<Object>}
 */
const markAsRead = async (notificationId, userId) => {
  // Ensure userId is an integer
  const userIdInt = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  try {
    const notification = await prisma.notification.updateFirst({
      where: {
        id: notificationId,
        user_id: userIdInt
      },
      data: {
        is_read: true,
        read_at: new Date()
      }
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    return serializeNotification(notification);
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    throw error;
  }
};

/**
 * Mark all notifications as read for a user
 * @param {number} userId - User ID
 * @returns {Promise<number>} - Count of updated notifications
 */
const markAllAsRead = async (userId) => {
  // Ensure userId is an integer
  const userIdInt = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  try {
    const result = await prisma.notification.updateMany({
      where: {
        user_id: userIdInt,
        is_read: false
      },
      data: {
        is_read: true,
        read_at: new Date()
      }
    });

    logger.info(`Marked ${result.count} notifications as read for user ${userIdInt}`);
    return result.count;
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    throw error;
  }
};

/**
 * Delete a notification
 * @param {number} notificationId - Notification ID
 * @param {number} userId - User ID (for authorization)
 * @returns {Promise<boolean>}
 */
const deleteNotification = async (notificationId, userId) => {
  // Ensure userId is an integer
  const userIdInt = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  try {
    const result = await prisma.notification.deleteMany({
      where: {
        id: notificationId,
        user_id: userIdInt
      }
    });

    return result.count > 0;
  } catch (error) {
    logger.error('Error deleting notification:', error);
    throw error;
  }
};

/**
 * Clear all notifications for a user
 * @param {number} userId - User ID
 * @returns {Promise<number>}
 */
const clearAllNotifications = async (userId) => {
  // Ensure userId is an integer
  const userIdInt = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  try {
    const result = await prisma.notification.deleteMany({
      where: { user_id: userIdInt }
    });

    logger.info(`Cleared ${result.count} notifications for user ${userIdInt}`);
    return result.count;
  } catch (error) {
    logger.error('Error clearing notifications:', error);
    throw error;
  }
};

/**
 * Clean up expired notifications (run periodically)
 */
const cleanupExpiredNotifications = async () => {
  try {
    const result = await prisma.notification.deleteMany({
      where: {
        expires_at: { lt: new Date() }
      }
    });

    logger.info(`Cleaned up ${result.count} expired notifications`);
    return result.count;
  } catch (error) {
    logger.error('Error cleaning up notifications:', error);
    throw error;
  }
};

/**
 * Get unread count for a user
 * @param {number} userId - User ID
 * @returns {Promise<number>}
 */
const getUnreadCount = async (userId) => {
  // Ensure userId is an integer
  const userIdInt = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  try {
    return await prisma.notification.count({
      where: {
        user_id: userIdInt,
        is_read: false,
        OR: [
      { expires_at: null },
      { expires_at: { gte: new Date() } }
    ]
      }
    });
  } catch (error) {
    logger.error('Error getting unread count:', error);
    throw error;
  }
};

/**
 * Helper: Serialize notification for API response
 */
const serializeNotification = (notification) => ({
  ...notification,
  metadata: notification.metadata ? JSON.parse(notification.metadata) : null,
  created_at: notification.created_at.toISOString(),
  read_at: notification.read_at?.toISOString() || null,
  expires_at: notification.expires_at?.toISOString() || null
});

/**
 * Helper: Group notifications by date
 */
const groupNotificationsByDate = (notifications) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const groups = {
    today: [],
    yesterday: [],
    thisWeek: [],
    earlier: []
  };

  notifications.forEach(notification => {
    const date = new Date(notification.created_at);
    if (date >= today) {
      groups.today.push(serializeNotification(notification));
    } else if (date >= yesterday) {
      groups.yesterday.push(serializeNotification(notification));
    } else if (date >= lastWeek) {
      groups.thisWeek.push(serializeNotification(notification));
    } else {
      groups.earlier.push(serializeNotification(notification));
    }
  });

  return groups;
};

// ==========================================
// SSE (Server-Sent Events) for real-time
// ==========================================

// Store active SSE connections
const sseClients = new Map(); // userId -> Set of response objects

/**
 * Add SSE client
 */
const addSSEClient = (userId, res) => {
  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set());
  }
  sseClients.get(userId).add(res);
};

/**
 * Remove SSE client
 */
const removeSSEClient = (userId, res) => {
  if (sseClients.has(userId)) {
    sseClients.get(userId).delete(res);
    if (sseClients.get(userId).size === 0) {
      sseClients.delete(userId);
    }
  }
};

/**
 * Emit notification to connected clients
 */
const emitNotification = (userId, notification) => {
  const clients = sseClients.get(userId);
  if (!clients || clients.size === 0) {
    return false;
  }

  const data = JSON.stringify({
    type: 'notification',
    data: serializeNotification(notification)
  });

  clients.forEach(res => {
    try {
      res.write(`data: ${data}\n\n`);
    } catch (error) {
      // Client disconnected, will be cleaned up on next heartbeat
    }
  });

  return true;
};

/**
 * Get SSE clients count for a user
 */
const getSSEClientCount = (userId) => {
  return sseClients.has(userId) ? sseClients.get(userId).size : 0;
};

// ==========================================
// Notification Templates
// ==========================================

const TEMPLATES = {
  // Payment notifications
  PAYMENT_RECEIVED: {
    type: NOTIFICATION_TYPES.PAYMENT,
    priority: PRIORITY.HIGH,
    getTitle: (amount, packName) => `¡Nuevo pago recibido!`,
    getMessage: (amount, packName) => `Has recibido un pago de $${amount}${packName ? ` por ${packName}` : ''}.`,
    action_text: 'Ver detalles'
  },

  // Setup/Warning notifications
  BOT_NOT_CONNECTED: {
    type: NOTIFICATION_TYPES.WARNING,
    priority: PRIORITY.HIGH,
    title: 'Bot no conectado',
    message: 'Tu bot de Telegram no está conectado. Los mensajes no serán respondidos automáticamente.',
    action_url: '/settings',
    action_text: 'Conectar bot'
  },

  MISSING_API_KEY: {
    type: NOTIFICATION_TYPES.WARNING,
    priority: PRIORITY.HIGH,
    title: 'API Key faltante',
    message: 'Tu clave de API de IA no está configurada. El bot no podrá generar respuestas.',
    action_url: '/settings',
    action_text: 'Configurar API'
  },

  PAYMENT_NOT_CONFIGURED: {
    type: NOTIFICATION_TYPES.WARNING,
    priority: PRIORITY.MEDIUM,
    title: 'Pagos no configurados',
    message: 'No has configurado métodos de pago. Los usuarios no podrán realizar compras.',
    action_url: '/settings',
    action_text: 'Configurar pagos'
  },

  SESSION_EXPIRED: {
    type: NOTIFICATION_TYPES.WARNING,
    priority: PRIORITY.HIGH,
    title: 'Sesión de Telegram expirada',
    message: 'Tu sesión de Telegram ha expirado. Necesitas volver a conectar el bot.',
    action_url: '/settings',
    action_text: 'Reconectar'
  },

  // AI Suggestions
  OPPORTUNITY_NEW_CONTENT: {
    type: NOTIFICATION_TYPES.SUGGESTION,
    priority: PRIORITY.MEDIUM,
    getTitle: () => 'Oportunidad detectada',
    getMessage: (content) => `Los usuarios están preguntando por "${content}". Considera agregar este contenido.`,
    action_url: '/media',
    action_text: 'Agregar contenido'
  },

  RESPONSE_TIME_IMPROVEMENT: {
    type: NOTIFICATION_TYPES.SUGGESTION,
    priority: PRIORITY.LOW,
    title: 'Mejora tu tiempo de respuesta',
    message: 'Responder más rápido puede aumentar tus conversiones hasta un 30%.',
    action_url: '/settings',
    action_text: 'Ver tips'
  }
};

/**
 * Create notification from template
 */
const createFromTemplate = async (templateKey, userId, variables = {}) => {
  const template = TEMPLATES[templateKey];
  if (!template) {
    throw new Error(`Unknown notification template: ${templateKey}`);
  }

  const notificationData = {
    user_id: userId,
    type: template.type,
    priority: template.priority,
    title: typeof template.getTitle === 'function'
      ? template.getTitle(...(variables.titleArgs || []))
      : template.title,
    message: typeof template.getMessage === 'function'
      ? template.getMessage(...(variables.messageArgs || []))
      : template.message,
    action_url: variables.action_url || template.action_url,
    action_text: variables.action_text || template.action_text,
    skipRateLimit: template.type === NOTIFICATION_TYPES.PAYMENT
  };

  return createNotification(notificationData);
};

module.exports = {
  // Types
  NOTIFICATION_TYPES,
  PRIORITY,

  // CRUD
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  getUnreadCount,
  cleanupExpiredNotifications,

  // SSE
  addSSEClient,
  removeSSEClient,
  emitNotification,
  getSSEClientCount,

  // Templates
  TEMPLATES,
  createFromTemplate
};