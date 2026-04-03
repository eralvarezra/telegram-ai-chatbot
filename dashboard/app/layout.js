'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { I18nProvider } from '@/src/i18n';
import { NotificationProvider } from '@/context/NotificationContext';
import './globals.css';

// Pages that don't require authentication
const publicPages = ['/', '/landing', '/login', '/auth/callback'];

function AppContent({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();

  // Check if current page is a landing page (root or /landing)
  const isLandingPage = pathname === '/' || pathname === '/landing';
  const isOnboarding = pathname === '/onboarding';

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="bg-zinc-950 text-white min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Login page (no auth needed)
  if (pathname === '/login') {
    return (
      <div className="bg-zinc-950 text-white min-h-screen">
        {children}
      </div>
    );
  }

  // Auth callback page
  if (pathname === '/auth/callback') {
    return (
      <div className="bg-zinc-950 text-white min-h-screen">
        {children}
      </div>
    );
  }

  // Onboarding page - only accessible when logged in
  if (isOnboarding) {
    if (!user) {
      // Not logged in, redirect to landing
      router.push('/');
      return null;
    }
    // Show onboarding for logged in users
    return (
      <div className="bg-zinc-950 text-white min-h-screen">
        {children}
      </div>
    );
  }

  // Landing page - show without sidebar for unauthenticated users
  if (isLandingPage) {
    if (user) {
      // Authenticated user sees dashboard
      return (
        <div className="flex">
          <Sidebar />
          <main className="flex-1 lg:ml-64 min-h-screen">
            {children}
          </main>
        </div>
      );
    }
    // Unauthenticated user sees landing page
    return (
      <div className="bg-zinc-950 text-white min-h-screen">
        {children}
      </div>
    );
  }

  // Protected pages - require authentication
  if (!user) {
    router.push('/');
    return null;
  }

  // Authenticated users - show dashboard with sidebar
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 lg:ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-white min-h-screen">
        <AuthProvider>
          <I18nProvider>
            <NotificationProvider>
              <AppContent>{children}</AppContent>
            </NotificationProvider>
          </I18nProvider>
        </AuthProvider>
      </body>
    </html>
  );
}