'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/src/i18n';
import AuthLayout from '@/components/auth/AuthLayout';
import AuthCard from '@/components/auth/AuthCard';
import InputField from '@/components/auth/InputField';
import SocialLoginButtons from '@/components/auth/SocialLoginButtons';

const API_URL = 'http://localhost:3000';

export default function LoginPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [plan, setPlan] = useState('free'); // 'free' | 'premium'
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithEmail, register } = useAuth();
  const { t } = useI18n();

  // Check for OAuth callback errors
  const oauthError = searchParams.get('error');

  // Check if Google OAuth is configured
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const googleOAuthEnabled = !!googleClientId;

  // Validation functions
  const validateEmail = (email) => {
    if (!email) return t('auth.errors.emailRequired') || 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return t('auth.errors.emailInvalid') || 'Invalid email format';
    return null;
  };

  const validatePassword = (password) => {
    if (!password) return t('auth.errors.passwordRequired') || 'Password is required';
    if (mode === 'register' && password.length < 6) return t('auth.errors.passwordShort') || 'Password must be at least 6 characters';
    return null;
  };

  const validateName = (name) => {
    if (!name || name.trim().length < 2) return t('auth.errors.nameRequired') || 'Name is required';
    return null;
  };

  // Real-time validation
  const handleEmailChange = (value) => {
    setEmail(value);
    if (value) {
      setErrors(prev => ({ ...prev, email: validateEmail(value) }));
    } else {
      setErrors(prev => ({ ...prev, email: null }));
    }
  };

  const handlePasswordChange = (value) => {
    setPassword(value);
    if (value) {
      setErrors(prev => ({ ...prev, password: validatePassword(value) }));
    } else {
      setErrors(prev => ({ ...prev, password: null }));
    }
  };

  const handleNameChange = (value) => {
    setName(value);
    if (value && mode === 'register') {
      setErrors(prev => ({ ...prev, name: validateName(value) }));
    } else {
      setErrors(prev => ({ ...prev, name: null }));
    }
  };

  // Check if app needs setup
  const checkNeedsSetup = async () => {
    try {
      const res = await fetch(`${API_URL}/api/setup/needs-onboarding`);
      const data = await res.json();
      return data.needsOnboarding;
    } catch (err) {
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    // Validate all fields
    const newErrors = {};
    const emailError = validateEmail(email);
    if (emailError) newErrors.email = emailError;
    const passwordError = validatePassword(password);
    if (passwordError) newErrors.password = passwordError;
    if (mode === 'register') {
      const nameError = validateName(name);
      if (nameError) newErrors.name = nameError;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    let result;
    if (mode === 'login') {
      result = await loginWithEmail(email, password);
    } else if (mode === 'register') {
      result = await register(email, password, name, plan);
    }

    if (result.success) {
      const needsSetup = await checkNeedsSetup();
      if (needsSetup) {
        router.push('/onboarding');
      } else if (result.needsOnboarding) {
        router.push('/onboarding');
      } else {
        router.push('/');
      }
    } else {
      setErrors({ submit: result.error });
    }

    setLoading(false);
  };

  const handleGoogleLogin = () => {
    window.location.href = 'http://localhost:3000/api/auth/google';
  };

  // Mode switching functions
  const switchToRegister = () => {
    setMode('register');
    setErrors({});
  };

  const switchToLogin = () => {
    setMode('login');
    setErrors({});
  };

  return (
    <AuthLayout>
      <AuthCard title={mode === 'register' ? t('auth.createAccountTitle') : undefined} subtitle={mode === 'register' ? t('auth.createAccountSubtitle') : undefined}>
        {/* OAuth Error */}
        {oauthError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm"
          >
            {oauthError === 'oauth_denied' && t('auth.errors.oauthDenied')}
            {oauthError === 'oauth_failed' && t('auth.errors.oauthFailed')}
            {oauthError === 'oauth_not_configured' && t('auth.errors.oauthNotConfigured')}
            {oauthError === 'no_code' && t('auth.errors.noCode')}
          </motion.div>
        )}

        {/* Google OAuth Button */}
        {googleOAuthEnabled && (
          <SocialLoginButtons onGoogleLogin={handleGoogleLogin} />
        )}

        {/* Divider */}
        {googleOAuthEnabled && (
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-zinc-900/50 text-zinc-500">{t('auth.orContinueWith')}</span>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name field (register mode) */}
          {mode === 'register' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <InputField
                type="text"
                placeholder={t('auth.namePlaceholder')}
                value={name}
                onChange={handleNameChange}
                icon="user"
                error={errors.name}
                autoFocus={mode === 'register'}
              />
            </motion.div>
          )}

          {/* Email field */}
          <InputField
            type="email"
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChange={handleEmailChange}
            icon="email"
            error={errors.email}
            autoFocus={mode === 'login'}
          />

          {/* Password field */}
          <InputField
            type="password"
            placeholder={t('auth.passwordPlaceholder')}
            value={password}
            onChange={handlePasswordChange}
            icon="lock"
            error={errors.password}
          />

          {/* Plan Selection (register mode only) */}
          {mode === 'register' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Selecciona tu plan
              </label>
              <div className="grid grid-cols-2 gap-3">
                {/* Free Plan */}
                <button
                  type="button"
                  onClick={() => setPlan('free')}
                  className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                    plan === 'free'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-white">Free</span>
                    {plan === 'free' && (
                      <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">$0<span className="text-sm font-normal text-zinc-400">/mes</span></div>
                  <ul className="text-xs text-zinc-400 space-y-1">
                    <li className="flex items-center gap-1">
                      <span className="text-yellow-500">⚠️</span>
                      Tu propia API key
                    </li>
                    <li className="flex items-center gap-1">
                      <span className="text-blue-500">✓</span>
                      50 mensajes/día
                    </li>
                    <li className="flex items-center gap-1">
                      <span className="text-zinc-500">✗</span>
                      Sin agente personalizado
                    </li>
                  </ul>
                </button>

                {/* Premium Plan */}
                <button
                  type="button"
                  onClick={() => setPlan('premium')}
                  className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                    plan === 'premium'
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                  }`}
                >
                  <div className="absolute -top-2 -right-2">
                    <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      POPULAR
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-white">Premium</span>
                    {plan === 'premium' && (
                      <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">$29<span className="text-sm font-normal text-zinc-400">/mes</span></div>
                  <ul className="text-xs text-zinc-400 space-y-1">
                    <li className="flex items-center gap-1">
                      <span className="text-green-500">✓</span>
                      API key incluida
                    </li>
                    <li className="flex items-center gap-1">
                      <span className="text-green-500">✓</span>
                      Mensajes ilimitados
                    </li>
                    <li className="flex items-center gap-1">
                      <span className="text-green-500">✓</span>
                      Agente personalizado
                    </li>
                    <li className="flex items-center gap-1">
                      <span className="text-green-500">✓</span>
                      Memoria de conversaciones
                    </li>
                  </ul>
                </button>
              </div>
            </motion.div>
          )}

          {/* Forgot password (login mode only) */}
          {mode === 'login' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-end"
            >
              <button
                type="button"
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                {t('auth.forgotPassword')}
              </button>
            </motion.div>
          )}

          {/* Submit Error */}
          {errors.submit && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm"
            >
              {errors.submit}
            </motion.div>
          )}

          {/* Submit Button */}
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.01 }}
            whileTap={{ scale: loading ? 1 : 0.99 }}
            className={`w-full text-white font-semibold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg ${
              mode === 'register' && plan === 'premium'
                ? 'bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-600 shadow-purple-500/25'
                : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-600 shadow-blue-500/25'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                <span>{mode === 'register' ? t('auth.creatingAccount') : t('auth.signingIn')}</span>
              </>
            ) : (
              <span>{mode === 'register' ? t('auth.createAccount') : t('auth.signIn')}</span>
            )}
          </motion.button>
        </form>

        {/* Mode Switcher */}
        <div className="mt-8">
          {mode === 'login' ? (
            <p className="text-center text-zinc-500 text-sm">
              {t('auth.noAccount')}{' '}
              <button
                type="button"
                onClick={switchToRegister}
                className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                {t('auth.signUp')}
              </button>
            </p>
          ) : (
            <p className="text-center text-zinc-500 text-sm">
              {t('auth.haveAccount')}{' '}
              <button
                type="button"
                onClick={switchToLogin}
                className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                {t('auth.signIn')}
              </button>
            </p>
          )}
        </div>

        {/* Google OAuth setup instructions */}
        {!googleOAuthEnabled && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 p-4 bg-zinc-800/50 border border-white/5 rounded-xl text-sm text-zinc-400"
          >
            <p className="font-medium text-zinc-300 mb-2">{t('auth.enableGoogle')}</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>{t('auth.googleStep1')}</li>
              <li>{t('auth.googleStep2')}</li>
              <li>{t('auth.googleStep3')}</li>
              <li>{t('auth.googleStep4')}</li>
            </ol>
          </motion.div>
        )}
      </AuthCard>
    </AuthLayout>
  );
}