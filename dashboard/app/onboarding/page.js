'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function OnboardingPage() {
  const [step, setStep] = useState(1); // Start with Telegram
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Bot personality configuration (step 3)
  const [botName, setBotName] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Telegram credentials
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

  // Check if user is premium
  const isPremium = user?.plan === 'premium';

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

        if (data.telegram?.configured) {
          if (isPremium) {
            // Premium: Telegram -> Personality -> Done
            setStep(3); // Go to personality
          } else if (data.ai?.configured) {
            // Free: has AI configured, go to personality
            setStep(3);
          } else {
            // Free: needs AI first
            setStep(2);
          }
        }
        // else: stay at step 1 (Telegram)
      } catch (err) {
        console.error('Error checking credentials:', err);
      }
    };

    checkCredentials();
  }, [isPremium]);

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
        setMessage('¡Telegram conectado!');
        if (isPremium) {
          setStep(3); // Premium: go to personality
        } else {
          setStep(2); // Free: go to AI setup
        }
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
        setMessage('¡Telegram conectado exitosamente!');
        if (isPremium) {
          setStep(3); // Premium: go to personality
        } else {
          setStep(2); // Free: go to AI setup
        }
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
        setMessage('¡Telegram conectado exitosamente!');
        if (isPremium) {
          setStep(3); // Premium: go to personality
        } else {
          setStep(2); // Free: go to AI setup
        }
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
        setMessage('API configurada correctamente');
        setStep(3); // Go to personality setup
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

  // Handle personality/business configuration with AI
  const handlePersonalitySubmit = async (e) => {
    e.preventDefault();
    setIsGenerating(true);
    setError('');

    const token = getAuthToken();
    if (!token) {
      setError('No estás autenticado');
      setIsGenerating(false);
      return;
    }

    try {
      // Use AI to generate personality configuration
      const res = await fetch(`${API_URL}/api/config/generate-personality`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          botName: botName,
          businessDescription: businessDescription
        })
      });

      if (res.ok) {
        const data = await res.json();
        // Complete onboarding
        await completeOnboarding();
        setStep(4); // Go to complete
      } else {
        const data = await res.json();
        setError(data.error || 'Error al configurar');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSkip = async () => {
    await completeOnboarding();
    router.push('/');
  };

  // Step labels for progress
  const getStepLabels = () => {
    if (isPremium) {
      return ['Telegram', 'Personalidad', 'Listo'];
    }
    return ['Telegram', 'IA', 'Personalidad', 'Listo'];
  };

  const getCurrentStepIndex = () => {
    if (isPremium) {
      if (step <= 1) return 0;
      if (step === 1.5 || step === 1.6) return 0;
      if (step === 3) return 1;
      if (step >= 4) return 2;
      return 0;
    } else {
      if (step <= 1) return 0;
      if (step === 1.5 || step === 1.6) return 0;
      if (step === 2) return 1;
      if (step === 3) return 2;
      if (step >= 4) return 3;
      return 0;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Plan Badge */}
        {isPremium && (
          <div className="mb-4 p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-xl">⭐</span>
              <div>
                <p className="text-white font-semibold">Plan Premium</p>
                <p className="text-zinc-400 text-sm">API key incluida, mensajes ilimitados</p>
              </div>
            </div>
          </div>
        )}

        {!isPremium && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-xl">🆓</span>
              <div>
                <p className="text-white font-semibold">Plan Free</p>
                <p className="text-zinc-400 text-sm">Necesitarás agregar tu propia API key</p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white">Configurar tu Bot</h1>
          <p className="text-zinc-400 mt-2 text-sm">
            {user?.email && `Conectado como ${user.email}`}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {getStepLabels().map((label, idx) => {
            const currentIdx = getCurrentStepIndex();
            const isCompleted = currentIdx > idx;
            const isCurrent = currentIdx === idx;

            return (
              <div key={idx} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    isCompleted ? 'bg-green-600 text-white' :
                    isCurrent ? 'bg-blue-600 text-white' :
                    'bg-zinc-800 text-zinc-500'
                  }`}>
                    {isCompleted ? '✓' : idx + 1}
                  </div>
                  <span className="text-xs text-zinc-500 mt-1">{label}</span>
                </div>
                {idx < getStepLabels().length - 1 && (
                  <div className={`w-8 h-0.5 mx-1 ${isCompleted ? 'bg-green-600' : 'bg-zinc-800'}`} />
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-800 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        {message && !error && (
          <div className="mb-4 p-3 bg-green-900/50 border border-green-800 rounded-lg text-green-200 text-sm">
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

        {/* Step 2: AI (Only for FREE users) */}
        {step === 2 && !isPremium && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Configurar IA (Groq)</h2>
            <p className="text-zinc-400 text-sm mb-4">
              Obtén tu API key en <a href="https://console.groq.com/keys" target="_blank" className="text-blue-500 hover:underline">console.groq.com/keys</a>
            </p>

            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-yellow-200 text-sm">
                ⚠️ Como usuario Free, necesitas tu propia API key. Tienes un límite de 50 mensajes/día.
              </p>
            </div>

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
                {loading ? 'Guardando...' : 'Continuar'}
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

        {/* Step 3: Personality/Business Configuration (with AI) */}
        {step === 3 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-2">Configura tu Bot</h2>
            <p className="text-zinc-400 text-sm mb-6">
              Describe tu negocio y la IA configurará automáticamente la personalidad de tu bot.
            </p>

            <form onSubmit={handlePersonalitySubmit} className="space-y-5">
              <div>
                <label className="block text-sm text-zinc-300 mb-2">Nombre del Bot</label>
                <input
                  type="text"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  placeholder="Ej: Luna, Sofía, María..."
                  required
                />
                <p className="text-xs text-zinc-500 mt-1">El nombre con el que el bot se presentará</p>
              </div>

              <div>
                <label className="block text-sm text-zinc-300 mb-2">Describe tu Negocio</label>
                <textarea
                  value={businessDescription}
                  onChange={(e) => setBusinessDescription(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 min-h-[120px]"
                  placeholder="Ej: Vendo contenido exclusivo de fotos y videos personalizados. También hago videollamadas privadas y sexting. Mi estilo es muy coqueto y atrevido..."
                  required
                />
                <p className="text-xs text-zinc-500 mt-1">
                  ¿Qué servicios ofreces? ¿Cuál es tu estilo? ¿Cómo te comunicas con tus clientes?
                </p>
              </div>

              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-blue-200 text-sm">
                  🤖 La IA generará automáticamente:
                </p>
                <ul className="text-blue-100 text-sm mt-2 space-y-1">
                  <li>• Personalidad y tono del bot</li>
                  <li>• Lista de productos/servicios</li>
                  <li>• Mensaje de confirmación de pagos</li>
                  <li>• Estilo de respuestas</li>
                </ul>
              </div>

              {isPremium && (
                <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                  <p className="text-purple-200 text-sm">
                    ⭐ Como usuario Premium, podrás refinar aún más tu agente personalizado desde configuración
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={isGenerating || !botName.trim() || !businessDescription.trim()}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                    <span>Generando configuración...</span>
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    <span>Generar con IA</span>
                  </>
                )}
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

        {/* Step 4: Complete */}
        {step === 4 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-xl font-semibold text-white mb-2">¡Todo Listo!</h2>
            <p className="text-zinc-400 mb-4">
              Tu bot está configurado y listo para usar.
            </p>
            {isPremium && (
              <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <p className="text-purple-200 text-sm">
                  ⭐ Plan Premium activado<br/>
                  Disfruta de mensajes ilimitados y tu agente personalizado
                </p>
              </div>
            )}
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