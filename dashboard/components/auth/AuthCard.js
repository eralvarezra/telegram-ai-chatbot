'use client';

import { motion } from 'framer-motion';
import { useI18n } from '@/src/i18n';

export default function AuthCard({ children, title, subtitle }) {
  const { t } = useI18n();

  const displayTitle = title || t('auth.welcomeBack');
  const displaySubtitle = subtitle || t('auth.enterCredentials');

  return (
    <div className="w-full">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        {/* Mobile Logo */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="lg:hidden inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg shadow-blue-500/25 mb-4"
        >
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </motion.div>

        {/* Desktop header */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className="hidden lg:block text-2xl font-bold text-white mb-2">
            {displayTitle}
          </h2>
          <p className="hidden lg:block text-zinc-400">
            {displaySubtitle}
          </p>

          {/* Mobile header */}
          <h2 className="lg:hidden text-xl font-bold text-white mb-1">
            {displayTitle}
          </h2>
          <p className="lg:hidden text-sm text-zinc-400">
            {displaySubtitle}
          </p>
        </motion.div>
      </motion.div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="relative bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-6 lg:p-8 shadow-2xl shadow-black/20 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(39, 39, 42, 0.6) 0%, rgba(24, 24, 27, 0.8) 100%)',
        }}
      >
        {/* Glassmorphism overlay effect */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>

        {/* Content */}
        <div className="relative z-10">
          {children}
        </div>
      </motion.div>
    </div>
  );
}