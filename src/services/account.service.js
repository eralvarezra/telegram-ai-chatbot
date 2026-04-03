const prisma = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const logger = require('../utils/logger');

const SALT_ROUNDS = 12;

/**
 * Get user profile
 */
const getProfile = async (userId) => {
  // Ensure userId is an integer
  const userIdInt = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  const user = await prisma.adminUser.findUnique({
    where: { id: userIdInt },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      picture: true,
      role: true,
      created_at: true,
      last_login: true,
      two_factor_enabled: true,
      subscription: {
        select: {
          plan: true,
          status: true,
          current_period_end: true
        }
      }
    }
  });

  if (!user) {
    throw new Error('User not found');
  }

  return user;
};

/**
 * Update user profile
 */
const updateProfile = async (userId, data) => {
  // Ensure userId is an integer
  const userIdInt = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  const { name, username, picture } = data;

  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (username !== undefined) {
    // Check if username is already taken
    if (username) {
      const existing = await prisma.adminUser.findFirst({
        where: {
          username: username,
          NOT: { id: userIdInt }
        }
      });

      if (existing) {
        throw new Error('Username already taken');
      }
    }
    updateData.username = username;
  }
  if (picture !== undefined) updateData.picture = picture;

  const user = await prisma.adminUser.update({
    where: { id: userIdInt },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      picture: true,
      role: true
    }
  });

  logger.info(`Profile updated for user ${userIdInt}`);
  return user;
};

/**
 * Change password
 */
const changePassword = async (userId, currentPassword, newPassword) => {
  // Ensure userId is an integer
  const userIdInt = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  const user = await prisma.adminUser.findUnique({
    where: { id: userIdInt }
  });

  if (!user) {
    throw new Error('User not found');
  }

  // If user has a password (not Google-only), verify current password
  if (user.password_hash) {
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.adminUser.update({
    where: { id: userIdInt },
    data: { password_hash: hashedPassword }
  });

  // Invalidate all sessions except current
  await invalidateOtherSessions(userIdInt);

  logger.info(`Password changed for user ${userIdInt}`);
  return true;
};

/**
 * Enable 2FA - generates secret
 */
const enable2FA = async (userId) => {
  // Ensure userId is an integer
  const userIdInt = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  const secret = crypto.randomBytes(20).toString('base64');

  await prisma.adminUser.update({
    where: { id: userIdInt },
    data: {
      two_factor_enabled: true,
      two_factor_secret: secret
    }
  });

  return { secret };
};

/**
 * Disable 2FA
 */
const disable2FA = async (userId) => {
  // Ensure userId is an integer
  const userIdInt = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  await prisma.adminUser.update({
    where: { id: userIdInt },
    data: {
      two_factor_enabled: false,
      two_factor_secret: null
    }
  });

  logger.info(`2FA disabled for user ${userIdInt}`);
  return true;
};

/**
 * Get active sessions
 */
const getSessions = async (userId) => {
  // Ensure userId is an integer
  const userIdInt = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  const sessions = await prisma.userSession.findMany({
    where: {
      user_id: userIdInt,
      expires_at: { gt: new Date() }
    },
    orderBy: { last_active: 'desc' },
    select: {
      id: true,
      device_info: true,
      ip_address: true,
      last_active: true,
      created_at: true
    }
  });

  return sessions;
};

/**
 * Invalidate other sessions
 */
const invalidateOtherSessions = async (userId, currentTokenHash = null) => {
  // Ensure userId is an integer
  const userIdInt = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  const where = { user_id: userIdInt };

  if (currentTokenHash) {
    where.NOT = { token_hash: currentTokenHash };
  }

  await prisma.userSession.deleteMany({ where });
  logger.info(`Sessions invalidated for user ${userIdInt}`);
};

/**
 * Invalidate a specific session
 */
const invalidateSession = async (userId, sessionId) => {
  // Ensure userId is an integer
  const userIdInt = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  await prisma.userSession.deleteMany({
    where: {
      id: sessionId,
      user_id: userIdInt
    }
  });

  logger.info(`Session ${sessionId} invalidated for user ${userIdInt}`);
};

/**
 * Create session (for login)
 */
const createSession = async (userId, token, deviceInfo = null, ipAddress = null) => {
  // Ensure userId is an integer
  const userIdInt = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

  await prisma.userSession.create({
    data: {
      user_id: userIdInt,
      token_hash: tokenHash,
      device_info: deviceInfo,
      ip_address: ipAddress,
      expires_at: expiresAt
    }
  });

  // Update last login
  await prisma.adminUser.update({
    where: { id: userIdInt },
    data: { last_login: new Date() }
  });
};

/**
 * Validate session
 */
const validateSession = async (token) => {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const session = await prisma.userSession.findUnique({
    where: { token_hash: tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          two_factor_enabled: true
        }
      }
    }
  });

  if (!session) {
    return null;
  }

  if (session.expires_at < new Date()) {
    await prisma.userSession.delete({ where: { id: session.id } });
    return null;
  }

  // Update last active
  await prisma.userSession.update({
    where: { id: session.id },
    data: { last_active: new Date() }
  });

  return session;
};

/**
 * Delete account
 */
const deleteAccount = async (userId) => {
  // Ensure userId is an integer
  const userIdInt = typeof userId === 'string' ? parseInt(userId, 10) : userId;

  // Delete all related data
  await prisma.$transaction([
    prisma.userSession.deleteMany({ where: { user_id: userIdInt } }),
    prisma.userPaymentMethod.deleteMany({ where: { user_id: userIdInt } }),
    prisma.invoice.deleteMany({ where: { user_id: userIdInt } }),
    prisma.subscription.deleteMany({ where: { user_id: userIdInt } }),
    prisma.notification.deleteMany({ where: { user_id: userIdInt } }),
    prisma.userCredentials.deleteMany({ where: { user_id: userIdInt } }),
    prisma.adminUser.delete({ where: { id: userIdInt } })
  ]);

  logger.info(`Account deleted for user ${userIdInt}`);
  return true;
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  enable2FA,
  disable2FA,
  getSessions,
  invalidateOtherSessions,
  invalidateSession,
  createSession,
  validateSession,
  deleteAccount
};