'use client';

import { useI18n } from '@/src/i18n';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';

export default function Solution() {
  const { t } = useI18n();

  const features = [
    t('solution.features.0'),
    t('solution.features.1'),
    t('solution.features.2'),
    t('solution.features.3'),
    t('solution.features.4'),
  ];

  return (
    <section className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-600/5 via-transparent to-transparent" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 mb-6">
              <Sparkles className="w-4 h-4 text-green-400" />
              <span className="text-green-300 text-sm font-medium">{t('solution.title')}</span>
            </div>

            {/* Title */}
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              {t('solution.subtitle')}
            </h2>

            {/* Description */}
            <p className="text-zinc-400 text-lg mb-8 leading-relaxed">
              {t('solution.description')}
            </p>

            {/* Features List */}
            <ul className="space-y-4 mb-8">
              {features.map((feature, index) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                  </div>
                  <span className="text-zinc-300">{feature}</span>
                </motion.li>
              ))}
            </ul>

            {/* CTA */}
            <a
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold transition-all shadow-lg shadow-green-600/25 hover:shadow-green-500/25 hover:scale-105"
            >
              {t('solution.cta')}
              <ArrowRight className="w-5 h-5" />
            </a>
          </motion.div>

          {/* Right Visual */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative"
          >
            {/* Chat Preview Card */}
            <div className="relative bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm">
              {/* Header */}
              <div className="flex items-center gap-3 pb-4 border-b border-zinc-800 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-500" />
                <div>
                  <div className="text-white font-medium">Customer</div>
                  <div className="text-xs text-zinc-500">Online</div>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-green-400">AI Active</span>
                </div>
              </div>

              {/* Messages */}
              <div className="space-y-3">
                <div className="flex justify-end">
                  <div className="bg-zinc-800 rounded-2xl rounded-br-md px-4 py-2 max-w-[80%]">
                    <p className="text-sm text-zinc-300">Hey! I saw your content 👀</p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-blue-600 rounded-2xl rounded-bl-md px-4 py-2 max-w-[80%]">
                    <p className="text-sm text-white">Hey! Thanks for reaching out 😊 What caught your eye?</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-zinc-800 rounded-2xl rounded-br-md px-4 py-2 max-w-[80%]">
                    <p className="text-sm text-zinc-300">The premium content... how does it work?</p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-blue-600 rounded-2xl rounded-bl-md px-4 py-2 max-w-[80%]">
                    <p className="text-sm text-white">Great choice! Premium gives you access to exclusive content plus personal interactions. Want me to tell you more? 💫</p>
                  </div>
                </div>
              </div>

              {/* Typing indicator */}
              <div className="flex justify-start mt-3">
                <div className="bg-zinc-800 rounded-2xl px-4 py-2">
                  <div className="flex gap-1">
                    <motion.div
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                      className="w-2 h-2 rounded-full bg-zinc-500"
                    />
                    <motion.div
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                      className="w-2 h-2 rounded-full bg-zinc-500"
                    />
                    <motion.div
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                      className="w-2 h-2 rounded-full bg-zinc-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Floating badges */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="absolute -top-4 -right-4 px-3 py-1.5 rounded-full bg-green-500/20 border border-green-500/30 text-green-300 text-sm font-medium"
            >
              24/7 Active
            </motion.div>
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="absolute -bottom-4 -left-4 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 text-sm font-medium"
            >
              +89% Conversion
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}