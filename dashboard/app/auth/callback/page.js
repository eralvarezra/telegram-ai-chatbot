'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const API_URL = 'http://localhost:3000';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setTokenFromCallback } = useAuth();
  const [error, setError] = useState('');

  // Check if app needs setup (credentials not configured)
  const checkNeedsSetup = async () => {
    try {
      const res = await fetch(`${API_URL}/api/setup/needs-onboarding`);
      const data = await res.json();
      return data.needsOnboarding;
    } catch (err) {
      return false;
    }
  };

  useEffect(() => {
    const token = searchParams.get('token');
    const name = searchParams.get('name');
    const picture = searchParams.get('picture');
    const needsOnboarding = searchParams.get('needsOnboarding') === 'true';
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(errorParam);
      return;
    }

    if (token) {
      // Store token and redirect
      const userData = {
        name: name ? decodeURIComponent(name) : null,
        picture: picture ? decodeURIComponent(picture) : null
      };
      setTokenFromCallback(token, userData, needsOnboarding);

      // Check credentials and redirect appropriately
      const redirectAfterAuth = async () => {
        const needsSetup = await checkNeedsSetup();

        if (needsSetup) {
          // App needs setup (Telegram/AI not configured)
          router.push('/onboarding');
        } else if (needsOnboarding) {
          // User needs onboarding
          router.push('/onboarding');
        } else {
          router.push('/');
        }
      };

      redirectAfterAuth();
    } else {
      // Check for Google OAuth callback in URL hash (for client-side flow)
      const hash = window.location.hash;
      if (hash) {
        const params = new URLSearchParams(hash.substring(1));
        const idToken = params.get('id_token');
        const accessToken = params.get('access_token');

        if (idToken || accessToken) {
          // Exchange token with backend
          exchangeGoogleToken(idToken, accessToken);
        } else {
          setError('No se recibió token de autenticación');
        }
      } else {
        setError('No se recibieron parámetros de autenticación');
      }
    }
  }, [searchParams, router, setTokenFromCallback]);

  const exchangeGoogleToken = async (idToken, accessToken) => {
    try {
      const res = await fetch('http://localhost:3000/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });

      const data = await res.json();

      if (data.success && data.token) {
        setTokenFromCallback(data.token, data.user, data.needsOnboarding);

        // Check credentials and redirect appropriately
        const needsSetup = await checkNeedsSetup();

        if (needsSetup) {
          router.push('/onboarding');
        } else if (data.needsOnboarding) {
          router.push('/onboarding');
        } else {
          router.push('/');
        }
      } else {
        setError(data.error || 'Error en autenticación');
      }
    } catch (err) {
      setError('Error de conexión');
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">✕</div>
          <h2 className="text-xl font-semibold text-white mb-2">Error de autenticación</h2>
          <p className="text-zinc-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/login')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg"
          >
            Volver al login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-md w-full text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-white mb-2">Autenticando...</h2>
        <p className="text-zinc-400">Por favor espera mientras verificamos tu cuenta</p>
      </div>
    </div>
  );
}