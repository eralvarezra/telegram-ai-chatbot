const prisma = require('../config/database');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

/**
 * Generate JWT token for user
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

/**
 * Verify JWT token
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

/**
 * Hash password using SHA-256
 */
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

/**
 * Find or create user from Google OAuth
 */
const findOrCreateGoogleUser = async (googleUser, plan = 'free') => {
  const { email, name, picture, sub: googleId } = googleUser;

  let user = await prisma.adminUser.findUnique({
    where: { email }
  });

  if (user) {
    // Update user info
    user = await prisma.adminUser.update({
      where: { id: user.id },
      data: {
        name: name || user.name,
        picture: picture || user.picture,
        google_id: googleId,
        last_login: new Date()
      }
    });
    return { user, isNew: false };
  }

  // Validate plan
  const validPlans = ['free', 'premium'];
  const userPlan = validPlans.includes(plan) ? plan : 'free';

  // Create new user
  user = await prisma.adminUser.create({
    data: {
      email,
      name: name || email.split('@')[0],
      picture,
      google_id: googleId,
      role: 'admin',
      plan: userPlan,
      onboarding_completed: false,
      last_login: new Date()
    }
  });

  return { user, isNew: true };
};

/**
 * Find user by email
 */
const findUserByEmail = async (email) => {
  return prisma.adminUser.findUnique({
    where: { email }
  });
};

/**
 * Create user with email and password
 */
const createUser = async (email, password, name, plan = 'free') => {
  const hashedPassword = hashPassword(password);

  // Validate plan
  const validPlans = ['free', 'premium'];
  const userPlan = validPlans.includes(plan) ? plan : 'free';

  return prisma.adminUser.create({
    data: {
      email,
      name: name || email.split('@')[0],
      password_hash: hashedPassword,
      role: 'admin',
      plan: userPlan,
      onboarding_completed: false
    }
  });
};

/**
 * Verify password
 */
const verifyPassword = (user, password) => {
  if (!user.password_hash) return false;
  return user.password_hash === hashPassword(password);
};

/**
 * Update last login
 */
const updateLastLogin = async (userId) => {
  return prisma.adminUser.update({
    where: { id: userId },
    data: { last_login: new Date() }
  });
};

/**
 * Get all admin users
 */
const getAllAdminUsers = async () => {
  return prisma.adminUser.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      picture: true,
      role: true,
      created_at: true,
      last_login: true
    }
  });
};

/**
 * Delete admin user
 */
const deleteAdminUser = async (userId) => {
  return prisma.adminUser.delete({
    where: { id: userId }
  });
};

/**
 * Complete user onboarding
 */
const completeOnboarding = async (userId) => {
  return prisma.adminUser.update({
    where: { id: userId },
    data: { onboarding_completed: true }
  });
};

/**
 * Check if user needs onboarding
 */
const needsOnboarding = async (userId) => {
  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { onboarding_completed: true }
  });
  return !user?.onboarding_completed;
};

/**
 * Get Google OAuth URL
 */
const getGoogleOAuthUrl = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback';

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account'
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

/**
 * Exchange Google OAuth code for tokens
 */
const getGoogleTokens = async (code) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback';

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code: ${error}`);
  }

  return response.json();
};

/**
 * Get Google user info from tokens
 */
const getGoogleUserInfo = async (accessToken) => {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error('Failed to get user info');
  }

  return response.json();
};

module.exports = {
  generateToken,
  verifyToken,
  hashPassword,
  findOrCreateGoogleUser,
  findUserByEmail,
  createUser,
  verifyPassword,
  updateLastLogin,
  getAllAdminUsers,
  deleteAdminUser,
  completeOnboarding,
  needsOnboarding,
  getGoogleOAuthUrl,
  getGoogleTokens,
  getGoogleUserInfo
};