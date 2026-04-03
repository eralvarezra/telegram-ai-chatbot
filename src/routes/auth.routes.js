const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const authService = require('../services/auth.service');
const logger = require('../utils/logger');

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // If email is provided, use new auth system
    if (email) {
      if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email y contraseña requeridos' });
      }

      const user = await authService.findUserByEmail(email);

      if (!user || !user.password_hash) {
        return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
      }

      if (!authService.verifyPassword(user, password)) {
        return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
      }

      await authService.updateLastLogin(user.id);

      const token = authService.generateToken(user);

      res.json({
        success: true,
        message: 'Login exitoso',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          picture: user.picture,
          role: user.role,
          onboarding_completed: user.onboarding_completed ?? false
        }
      });
    } else {
      // Legacy password-only auth (for backward compatibility)
      if (!password) {
        return res.status(400).json({ success: false, error: 'Contraseña requerida' });
      }

      // Get stored password from BotConfig
      const config = await prisma.botConfig.findUnique({ where: { id: 1 } });
      const storedPassword = config?.admin_password || 'admin123';

      if (password === storedPassword) {
        res.json({
          success: true,
          message: 'Login exitoso',
          token: Buffer.from(`authenticated_${Date.now()}`).toString('base64')
        });
      } else {
        res.status(401).json({ success: false, error: 'Contraseña inválida' });
      }
    }
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Error en login' });
  }
});

/**
 * POST /api/auth/register
 * Register new admin user
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email y contraseña requeridos' });
    }

    // Check if user already exists
    const existingUser = await authService.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'El email ya está registrado' });
    }

    // Create user
    const user = await authService.createUser(email, password, name);

    const token = authService.generateToken(user);

    res.json({
      success: true,
      message: 'Usuario creado exitosamente',
      token,
      needsOnboarding: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        onboarding_completed: false
      }
    });
  } catch (error) {
    logger.error('Register error:', error);
    res.status(500).json({ success: false, error: 'Error al registrar' });
  }
});

/**
 * GET /api/auth/google
 * Redirect to Google OAuth
 */
router.get('/google', (req, res) => {
  try {
    const url = authService.getGoogleOAuthUrl();
    res.redirect(url);
  } catch (error) {
    logger.error('Google OAuth error:', error);
    res.redirect('/login?error=oauth_failed');
  }
});

/**
 * GET /api/auth/google/callback
 * Google OAuth callback
 */
router.get('/google/callback', async (req, res) => {
  try {
    const { code, error } = req.query;

    if (error) {
      logger.error('Google OAuth error:', error);
      return res.redirect('/login?error=oauth_denied');
    }

    if (!code) {
      return res.redirect('/login?error=no_code');
    }

    // Check if Google OAuth is configured
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      logger.error('Google OAuth not configured');
      return res.redirect('/login?error=oauth_not_configured');
    }

    // Exchange code for tokens
    const tokens = await authService.getGoogleTokens(code);

    // Get user info
    const googleUser = await authService.getGoogleUserInfo(tokens.access_token);

    // Find or create user
    const { user, isNew } = await authService.findOrCreateGoogleUser(googleUser);

    // Generate JWT token
    const token = authService.generateToken(user);

    // Redirect to frontend with token and onboarding status
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const needsOnboarding = isNew || !user.onboarding_completed;
    res.redirect(`${frontendUrl}/auth/callback?token=${token}&name=${encodeURIComponent(user.name || '')}&picture=${encodeURIComponent(user.picture || '')}&needsOnboarding=${needsOnboarding}`);
  } catch (error) {
    logger.error('Google callback error:', error);
    res.redirect('/login?error=oauth_failed');
  }
});

/**
 * POST /api/auth/google
 * Handle Google OAuth from frontend (alternative method)
 */
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ success: false, error: 'Token requerido' });
    }

    // Verify ID token with Google
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);

    if (!response.ok) {
      return res.status(401).json({ success: false, error: 'Token inválido' });
    }

    const googleUser = await response.json();

    // Validate required fields
    if (!googleUser.email) {
      return res.status(400).json({ success: false, error: 'Email no encontrado en el token' });
    }

    // Find or create user
    const { user, isNew } = await authService.findOrCreateGoogleUser(googleUser);

    // Generate JWT token
    const token = authService.generateToken(user);

    res.json({
      success: true,
      token,
      needsOnboarding: isNew || !user.onboarding_completed,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        role: user.role,
        onboarding_completed: user.onboarding_completed ?? false
      }
    });
  } catch (error) {
    logger.error('Google login error:', error);
    res.status(500).json({ success: false, error: 'Error en autenticación con Google' });
  }
});

/**
 * POST /api/auth/logout
 * Logout
 */
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Sesión cerrada' });
});

/**
 * GET /api/auth/verify
 * Verify JWT token
 */
router.get('/verify', async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No autenticado' });
  }

  const token = authHeader.split(' ')[1];

  // Try JWT verification first
  const decoded = authService.verifyToken(token);

  if (decoded) {
    // Get fresh user data
    const user = await prisma.adminUser.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, picture: true, role: true, onboarding_completed: true }
    });

    if (user) {
      return res.json({ success: true, authenticated: true, user });
    }
  }

  // Try legacy token verification
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    if (decoded.startsWith('authenticated_')) {
      return res.json({ success: true, authenticated: true, user: null });
    }
  } catch (e) {}

  res.status(401).json({ success: false, error: 'Token inválido' });
});

/**
 * POST /api/auth/change-password
 * Change password
 */
router.post('/change-password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Ambas contraseñas son requeridas' });
    }

    // Check if using JWT auth
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = authService.verifyToken(token);

      if (decoded) {
        const user = await authService.findUserByEmail(decoded.email);

        if (!user || !user.password_hash) {
          // User exists via Google OAuth, set new password
          await prisma.adminUser.update({
            where: { id: user.id },
            data: { password_hash: authService.hashPassword(newPassword) }
          });
          return res.json({ success: true, message: 'Contraseña actualizada' });
        }

        if (!authService.verifyPassword(user, currentPassword)) {
          return res.status(401).json({ success: false, error: 'Contraseña actual incorrecta' });
        }

        await prisma.adminUser.update({
          where: { id: user.id },
          data: { password_hash: authService.hashPassword(newPassword) }
        });

        return res.json({ success: true, message: 'Contraseña actualizada' });
      }
    }

    // Legacy password change
    const config = await prisma.botConfig.findUnique({ where: { id: 1 } });
    const storedPassword = config?.admin_password || 'admin123';

    if (currentPassword !== storedPassword) {
      return res.status(401).json({ success: false, error: 'Contraseña actual incorrecta' });
    }

    await prisma.botConfig.upsert({
      where: { id: 1 },
      update: { admin_password: newPassword },
      create: { id: 1, admin_password: newPassword }
    });

    res.json({ success: true, message: 'Contraseña actualizada' });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ success: false, error: 'Error al cambiar contraseña' });
  }
});

/**
 * GET /api/auth/users
 * Get all admin users (admin only)
 */
router.get('/users', async (req, res) => {
  try {
    const users = await authService.getAllAdminUsers();
    res.json({ success: true, users });
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener usuarios' });
  }
});

/**
 * DELETE /api/auth/users/:id
 * Delete admin user (admin only)
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    await authService.deleteAdminUser(userId);

    res.json({ success: true, message: 'Usuario eliminado' });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar usuario' });
  }
});

/**
 * POST /api/auth/complete-onboarding
 * Mark user onboarding as completed
 */
router.post('/complete-onboarding', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No autorizado' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = authService.verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ success: false, error: 'Token inválido' });
    }

    await authService.completeOnboarding(decoded.id);

    res.json({ success: true, message: 'Onboarding completado' });
  } catch (error) {
    logger.error('Complete onboarding error:', error);
    res.status(500).json({ success: false, error: 'Error al completar onboarding' });
  }
});

module.exports = router;