const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const logger = require('../utils/logger');

/**
 * Test endpoints for development/quick testing
 * These should be disabled in production
 */

/**
 * GET /api/test/users
 * List all users with their plans (for testing)
 */
router.get('/users', async (req, res) => {
  try {
    const users = await prisma.adminUser.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        created_at: true,
        daily_message_count: true,
        last_reset_date: true,
        user_api_key: true,
        user_api_provider: true,
        agent: {
          select: {
            id: true,
            name: true,
            tone: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    // Mask API keys
    const maskedUsers = users.map(user => ({
      ...user,
      has_api_key: !!user.user_api_key,
      user_api_key: user.user_api_key ? '****' : null
    }));

    res.json({
      success: true,
      count: maskedUsers.length,
      users: maskedUsers
    });
  } catch (error) {
    logger.error('Error listing users:', error);
    res.status(500).json({ success: false, error: 'Error al listar usuarios' });
  }
});

/**
 * GET /api/test/user/:id
 * Get specific user details
 */
router.get('/user/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    const user = await prisma.adminUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        created_at: true,
        daily_message_count: true,
        last_reset_date: true,
        user_api_provider: true,
        total_tokens_used: true,
        monthly_tokens_used: true,
        agent: {
          select: {
            id: true,
            name: true,
            tone: true,
            response_style: true,
            engagement_level: true,
            memory_enabled: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    res.json({ success: true, user });
  } catch (error) {
    logger.error('Error getting user:', error);
    res.status(500).json({ success: false, error: 'Error al obtener usuario' });
  }
});

/**
 * POST /api/test/user/:id/plan
 * Update user plan (for testing)
 */
router.post('/user/:id/plan', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { plan } = req.body;

    if (!['free', 'premium'].includes(plan)) {
      return res.status(400).json({
        success: false,
        error: 'Plan debe ser "free" o "premium"'
      });
    }

    const user = await prisma.adminUser.update({
      where: { id: userId },
      data: { plan }
    });

    // If upgrading to premium, create agent if not exists
    if (plan === 'premium') {
      const existingAgent = await prisma.agent.findUnique({
        where: { user_id: userId }
      });

      if (!existingAgent) {
        await prisma.agent.create({
          data: {
            user_id: userId,
            name: 'Assistant',
            tone: 'playful',
            response_style: 'short',
            engagement_level: 3,
            memory_enabled: true
          }
        });
      }
    }

    res.json({
      success: true,
      message: `Plan actualizado a ${plan}`,
      user: {
        id: user.id,
        email: user.email,
        plan: user.plan
      }
    });
  } catch (error) {
    logger.error('Error updating plan:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar plan' });
  }
});

/**
 * POST /api/test/user/:id/reset-count
 * Reset daily message count (for testing)
 */
router.post('/user/:id/reset-count', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    const user = await prisma.adminUser.update({
      where: { id: userId },
      data: {
        daily_message_count: 0,
        last_reset_date: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Contador de mensajes reiniciado',
      daily_message_count: user.daily_message_count
    });
  } catch (error) {
    logger.error('Error resetting count:', error);
    res.status(500).json({ success: false, error: 'Error al reiniciar contador' });
  }
});

/**
 * DELETE /api/test/user/:id
 * Delete a user (for testing)
 */
router.delete('/user/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Delete related records first
    await prisma.usageTracking.deleteMany({ where: { user_id: userId } });
    await prisma.userCredentials.delete({ where: { user_id: userId } }).catch(() => {});
    await prisma.agent.deleteMany({ where: { user_id: userId } });
    await prisma.subscription.deleteMany({ where: { user_id: userId } });

    // Delete user
    await prisma.adminUser.delete({ where: { id: userId } });

    res.json({ success: true, message: 'Usuario eliminado' });
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar usuario' });
  }
});

/**
 * GET /api/test/stats
 * Get database stats
 */
router.get('/stats', async (req, res) => {
  try {
    const [userCount, freeUsers, premiumUsers, agentCount, messageCount] = await Promise.all([
      prisma.adminUser.count(),
      prisma.adminUser.count({ where: { plan: 'free' } }),
      prisma.adminUser.count({ where: { plan: 'premium' } }),
      prisma.agent.count(),
      prisma.message.count()
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers: userCount,
        freeUsers,
        premiumUsers,
        agents: agentCount,
        messages: messageCount
      }
    });
  } catch (error) {
    logger.error('Error getting stats:', error);
    res.status(500).json({ success: false, error: 'Error al obtener estadísticas' });
  }
});

module.exports = router;