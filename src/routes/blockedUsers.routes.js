const express = require('express');
const router = express.Router();
const blockedUsersService = require('../services/blockedUsers.service');
const authMiddleware = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/blocked-users
 * Get all blocked users for the authenticated user
 */
router.get('/', async (req, res) => {
  try {
    const blockedUsers = await blockedUsersService.getBlockedUsers(req.user.id);
    res.json({
      success: true,
      data: blockedUsers
    });
  } catch (error) {
    logger.error('Error fetching blocked users:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener usuarios bloqueados'
    });
  }
});

/**
 * GET /api/blocked-users/check/:telegramId
 * Check if a specific Telegram user is blocked
 */
router.get('/check/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;

    if (!telegramId) {
      return res.status(400).json({
        success: false,
        error: 'Telegram ID es requerido'
      });
    }

    const isBlocked = await blockedUsersService.isBlocked(req.user.id, telegramId);
    res.json({
      success: true,
      isBlocked
    });
  } catch (error) {
    logger.error('Error checking blocked status:', error);
    res.status(500).json({
      success: false,
      error: 'Error al verificar estado de bloqueo'
    });
  }
});

/**
 * POST /api/blocked-users
 * Block a user
 * Body: { telegramId, username?, displayName?, reason? }
 */
router.post('/', async (req, res) => {
  try {
    const { telegramId, username, displayName, reason } = req.body;

    if (!telegramId) {
      return res.status(400).json({
        success: false,
        error: 'Telegram ID es requerido'
      });
    }

    // Validate telegramId is a valid number
    if (!/^\d+$/.test(telegramId.toString())) {
      return res.status(400).json({
        success: false,
        error: 'Telegram ID debe ser un número válido'
      });
    }

    const blockedUser = await blockedUsersService.blockUser(
      req.user.id,
      telegramId,
      username || null,
      displayName || null,
      reason || null
    );

    res.status(201).json({
      success: true,
      data: blockedUser,
      message: 'Usuario bloqueado exitosamente'
    });
  } catch (error) {
    logger.error('Error blocking user:', error);

    // Handle duplicate error
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'El usuario ya está bloqueado'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error al bloquear usuario'
    });
  }
});

/**
 * DELETE /api/blocked-users/telegram/:telegramId
 * Unblock a user by Telegram ID
 */
router.delete('/telegram/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;

    if (!telegramId) {
      return res.status(400).json({
        success: false,
        error: 'Telegram ID es requerido'
      });
    }

    const unblocked = await blockedUsersService.unblockUser(req.user.id, telegramId);

    if (!unblocked) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado en la lista de bloqueados'
      });
    }

    res.json({
      success: true,
      message: 'Usuario desbloqueado exitosamente'
    });
  } catch (error) {
    logger.error('Error unblocking user:', error);
    res.status(500).json({
      success: false,
      error: 'Error al desbloquear usuario'
    });
  }
});

/**
 * DELETE /api/blocked-users/:id
 * Unblock a user by block record ID
 */
router.delete('/:id', async (req, res) => {
  try {
    const blockId = parseInt(req.params.id, 10);

    if (isNaN(blockId)) {
      return res.status(400).json({
        success: false,
        error: 'ID inválido'
      });
    }

    const unblocked = await blockedUsersService.unblockUserById(req.user.id, blockId);

    if (!unblocked) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado en la lista de bloqueados'
      });
    }

    res.json({
      success: true,
      message: 'Usuario desbloqueado exitosamente'
    });
  } catch (error) {
    logger.error('Error unblocking user:', error);
    res.status(500).json({
      success: false,
      error: 'Error al desbloquear usuario'
    });
  }
});

/**
 * POST /api/blocked-users/refresh-cache
 * Refresh the cache for blocked users (admin endpoint)
 */
router.post('/refresh-cache', async (req, res) => {
  try {
    await blockedUsersService.refreshCache(req.user.id);
    res.json({
      success: true,
      message: 'Cache actualizado exitosamente'
    });
  } catch (error) {
    logger.error('Error refreshing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar cache'
    });
  }
});

module.exports = router;