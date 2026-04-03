'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const AuthContext = createContext(null);
const API_URL = 'http://localhost:3000';

export function AuthProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('auth_token');
    if (token) {
      verifyToken(token);
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (token) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        setUser({ authenticated: true, ...data.user });
      } else {
        localStorage.removeItem('auth_token');
        setUser(null);
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      localStorage.removeItem('auth_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Login with password (legacy)
  const login = async (password) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('auth_token', data.token);
        setUser({ authenticated: true, ...data.user });
        return { success: true, needsOnboarding: data.needsOnboarding || false };
      } else {
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error) {
      return { success: false, error: 'Connection error' };
    }
  };

  // Login with email and password
  const loginWithEmail = async (email, password) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('auth_token', data.token);
        setUser({ authenticated: true, ...data.user });
        return { success: true, needsOnboarding: data.needsOnboarding || false };
      } else {
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error) {
      return { success: false, error: 'Connection error' };
    }
  };

  // Register with email and password
  const register = async (email, password, name) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('auth_token', data.token);
        setUser({ authenticated: true, ...data.user });
        return { success: true, needsOnboarding: data.needsOnboarding || false };
      } else {
        return { success: false, error: data.error || 'Registration failed' };
      }
    } catch (error) {
      return { success: false, error: 'Connection error' };
    }
  };

  // Login with Google (using ID token from frontend)
  const loginWithGoogle = async (idToken) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('auth_token', data.token);
        setUser({ authenticated: true, ...data.user });
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Google login failed' };
      }
    } catch (error) {
      return { success: false, error: 'Connection error' };
    }
  };

  // Handle Google OAuth callback token
  const setTokenFromCallback = (token, userData, needsOnboarding = false) => {
    localStorage.setItem('auth_token', token);
    setUser({ authenticated: true, ...userData, needsOnboarding });
  };

  // Complete user onboarding
  const completeOnboarding = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/api/auth/complete-onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        setUser(prev => ({ ...prev, onboarding_completed: true }));
        return { success: true };
      }
      return { success: false, error: 'Error completing onboarding' };
    } catch (error) {
      return { success: false, error: 'Connection error' };
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('auth_token');
      setUser(null);
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      loginWithEmail,
      register,
      loginWithGoogle,
      setTokenFromCallback,
      completeOnboarding,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}