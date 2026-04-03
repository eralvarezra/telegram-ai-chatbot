const authService = require('../services/auth.service');
const prisma = require('../config/database');
const logger = require('../utils/logger');

/**
 * Authentication middleware
 * Extracts user from JWT token and attaches to req.user
 */
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  const token = authHeader.split(' ')[1];

  // Try JWT verification
  const decoded = authService.verifyToken(token);

  if (decoded) {
    try {
      // Get fresh user data
      const user = await prisma.adminUser.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          name: true,
          username: true,
          picture: true,
          role: true,
          stripe_customer_id: true,
          two_factor_enabled: true,
          onboarding_completed: true
        }
      });

      if (user) {
        req.user = user;
        return next();
      }
    } catch (error) {
      logger.error('Auth middleware error:', error);
    }
  }

  // Try legacy token verification
  try {
    const decodedLegacy = Buffer.from(token, 'base64').toString('utf-8');
    if (decodedLegacy.startsWith('authenticated_')) {
      // Legacy auth - get the first admin user or create a placeholder
      const adminUser = await prisma.adminUser.findFirst();

      if (adminUser) {
        req.user = {
          id: adminUser.id,
          email: adminUser.email,
          role: adminUser.role
        };
        return next();
      }
    }
  } catch (e) {
    // Invalid legacy token
  }

  return res.status(401).json({
    success: false,
    error: 'Invalid or expired token'
  });
};

/**
 * Admin role middleware
 * Requires user to have admin role
 */
const adminMiddleware = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }
  next();
};

/**
 * Optional authentication middleware
 * Attaches user if token is present, but doesn't require it
 */
const optionalAuthMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const decoded = authService.verifyToken(token);

    if (decoded) {
      try {
        const user = await prisma.adminUser.findUnique({
          where: { id: decoded.id },
          select: {
            id: true,
            email: true,
            name: true,
            username: true,
            picture: true,
            role: true,
            stripe_customer_id: true
          }
        });

        if (user) {
          req.user = user;
        }
      } catch (error) {
        logger.error('Optional auth middleware error:', error);
      }
    }
  }

  next();
};

module.exports = authMiddleware;
module.exports.adminMiddleware = adminMiddleware;
module.exports.optionalAuthMiddleware = optionalAuthMiddleware;