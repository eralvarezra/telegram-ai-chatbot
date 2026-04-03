'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [telegramApiId, setTelegramApiId] = useState('');
  const [telegramApiHash, setTelegramApiHash] = useState('');
  const [telegramPhone, setTelegramPhone] = useState('');
  const [aiApiKey, setAiApiKey] = useState('');

  // Verification states
  const [verificationCode, setVerificationCode] = useState('');
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [authStatus, setAuthStatus] = useState('idle');
  const [phoneNumber, setPhoneNumber] = useState('');

  const router = useRouter();
  const { user, completeOnboarding } = useAuth();

  const API_URL = 'http://localhost:3000';

  // Get auth token
  const getAuthToken = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  };

  // Poll for auth status when waiting
  useEffect(() => {
    if (authStatus === 'waiting_code' || authStatus === 'waiting_password' || authStatus === 'connecting') {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_URL}/api/telegram/status`);
          const data = await res.json();
          setAuthStatus(data.status);
          if (data.error) {
            setError(data.error);
          }
        } catch (err) {
          console.error('Error polling status:', err);
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [authStatus]);

  // Check if user already has credentials
  useEffect(() => {
    const checkCredentials = async () => {
      const token = getAuthToken();
      if (!token) return;

      try {
        const res = await fetch(`${API_URL}/api/credentials/status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.telegram?.configured && data.ai?.configured) {
          // User already has both configured, skip to complete
          setStep(3);
        } else if (data.telegram?.configured) {
          // Has Telegram, needs AI
          setStep(2);
        }
      } catch (err) {
        console.error('Error checking credentials:', err);
      }
    };

    checkCredentials();
  }, []);

  const handleTelegramSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    const token = getAuthToken();
    if (!token) {
      setError('No estás autenticado');
      setLoading(false);
      return;
    }

    try {
      // Save credentials to user's account
      const credRes = await fetch(`${API_URL}/api/credentials/telegram`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          apiId: telegramApiId,
          apiHash: telegramApiHash,
          phone: telegramPhone
        })
      });

      if (!credRes.ok) {
        const data = await credRes.json();
        setError(data.error || 'Error al guardar credenciales');
        setLoading(false);
        return;
      }

      // Start Telegram connection
      const connectRes = await fetch(`${API_URL}/api/telegram/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const connectData = await connectRes.json();

      if (connectData.status === 'connected') {
        // Already connected (has session)
        setStep(2);
      } else if (connectData.status === 'waiting_code') {
        // Need verification code
        setAuthStatus('waiting_code');
        setPhoneNumber(connectData.phoneNumber);
        setStep(1.5);
        setMessage(connectData.message);
      } else if (connectData.status === 'error') {
        setError(connectData.error);
      }

    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const token = getAuthToken();

    try {
      const res = await fetch(`${API_URL}/api/telegram/verify-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code: verificationCode })
      });

      const data = await res.json();

      if (data.status === 'connected') {
        setAuthStatus('connected');
        setStep(2);
        setMessage('¡Telegram conectado exitosamente!');
      } else if (data.status === 'waiting_password') {
        setAuthStatus('waiting_password');
        setStep(1.6);
        setMessage(data.message);
      } else {
        setError(data.error || 'Error al verificar código');
      }

    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const token = getAuthToken();

    try {
      const res = await fetch(`${API_URL}/api/telegram/verify-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: twoFactorPassword })
      });

      const data = await res.json();

      if (data.status === 'connected') {
        setAuthStatus('connected');
        setStep(2);
        setMessage('¡Telegram conectado exitosamente!');
      } else {
        setError(data.error || 'Contraseña incorrecta');
      }

    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleAISubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const token = getAuthToken();
    if (!token) {
      setError('No estás autenticado');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/credentials/ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          apiKey: aiApiKey,
          provider: 'groq'
        })
      });

      if (res.ok) {
        // Complete onboarding
        await completeOnboarding();
        setStep(3);
      } else {
        const data = await res.json();
        setError(data.error || 'Error al guardar');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    await completeOnboarding();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white">Configurar tu Bot</h1>
          <p className="text-zinc-400 mt-2 text-sm">
            {user?.email && `Conectado como ${user.email}`}
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= s ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
              {s}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-800 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        {message && !error && (
          <div className="mb-4 p-3 bg-blue-900/50 border border-blue-800 rounded-lg text-blue-200 text-sm">
            {message}
          </div>
        )}

        {/* Step 1: Telegram Credentials */}
        {step === 1 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Conectar Telegram</h2>
            <p className="text-zinc-400 text-sm mb-4">
              Obtén tus credenciales en <a href="https://my.telegram.org/apps" target="_blank" className="text-blue-500 hover:underline">my.telegram.org/apps</a>
            </p>

            <form onSubmit={handleTelegramSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">API ID</label>
                <input
                  type="text"
                  value={telegramApiId}
                  onChange={(e) => setTelegramApiId(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
                  placeholder="12345678"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">API Hash</label>
                <input
                  type="text"
                  value={telegramApiHash}
                  onChange={(e) => setTelegramApiHash(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
                  placeholder="a1b2c3d4e5f6..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Número de teléfono</label>
                <input
                  type="text"
                  value={telegramPhone}
                  onChange={(e) => setTelegramPhone(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
                  placeholder="+50661714036"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white font-medium py-3 rounded-lg"
              >
                {loading ? 'Conectando...' : 'Continuar'}
              </button>

              <button
                type="button"
                onClick={handleSkip}
                className="w-full text-zinc-500 hover:text-zinc-300 text-sm py-2"
              >
                Omitir por ahora
              </button>
            </form>
          </div>
        )}

        {/* Step 1.5: Verification Code */}
        {step === 1.5 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-2">Verificar Telegram</h2>
            <p className="text-zinc-400 text-sm mb-4">
              Ingresa el código de verificación enviado a tu Telegram
            </p>
            {phoneNumber && (
              <p className="text-zinc-300 text-sm mb-4">
                📱 Número: <span className="text-white font-medium">{phoneNumber}</span>
              </p>
            )}

            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Código de verificación</label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white text-center text-2xl tracking-widest"
                  placeholder="12345"
                  maxLength={6}
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading || verificationCode.length < 4}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white font-medium py-3 rounded-lg"
              >
                {loading ? 'Verificando...' : 'Verificar'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setAuthStatus('idle');
                  setVerificationCode('');
                  setMessage('');
                }}
                className="w-full text-zinc-500 hover:text-zinc-300 text-sm py-2"
              >
                ← Volver
              </button>
            </form>
          </div>
        )}

        {/* Step 1.6: 2FA Password */}
        {step === 1.6 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-2">Verificación en Dos Pasos</h2>
            <p className="text-zinc-400 text-sm mb-4">
              Tu cuenta tiene verificación en dos pasos activada. Ingresa tu contraseña.
            </p>

            <form onSubmit={handleVerifyPassword} className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Contraseña de verificación</label>
                <input
                  type="password"
                  value={twoFactorPassword}
                  onChange={(e) => setTwoFactorPassword(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
                  placeholder="••••••••"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading || !twoFactorPassword}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white font-medium py-3 rounded-lg"
              >
                {loading ? 'Verificando...' : 'Verificar'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setAuthStatus('idle');
                  setTwoFactorPassword('');
                  setMessage('');
                }}
                className="w-full text-zinc-500 hover:text-zinc-300 text-sm py-2"
              >
                ← Volver al inicio
              </button>
            </form>
          </div>
        )}

        {/* Step 2: AI */}
        {step === 2 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Configurar IA (Groq)</h2>
            <p className="text-zinc-400 text-sm mb-4">
              Obtén tu API key en <a href="https://console.groq.com/keys" target="_blank" className="text-blue-500 hover:underline">console.groq.com/keys</a>
            </p>

            <form onSubmit={handleAISubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">API Key de Groq</label>
                <input
                  type="text"
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
                  placeholder="gsk_..."
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white font-medium py-3 rounded-lg"
              >
                {loading ? 'Guardando...' : 'Finalizar'}
              </button>

              <button
                type="button"
                onClick={handleSkip}
                className="w-full text-zinc-500 hover:text-zinc-300 text-sm py-2"
              >
                Omitir por ahora
              </button>
            </form>
          </div>
        )}

        {/* Step 3: Complete */}
        {step === 3 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-semibold text-white mb-2">¡Listo!</h2>
            <p className="text-zinc-400 mb-4">
              Tu bot está configurado y listo para usar.
            </p>
            <button
              onClick={() => router.push('/')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg"
            >
              Ir al Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}