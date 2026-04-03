'use client';

import { useI18n } from '@/src/i18n';
import { motion } from 'framer-motion';
import { Frown, MessageSquareX, Clock } from 'lucide-react';

export default function Problem() {
  const { t } = useI18n();

  const problems = [
    {
      icon: MessageSquareX,
      title: t('problem.problems.0.title'),
      description: t('problem.problems.0.description'),
    },
    {
      icon: Frown,
      title: t('problem.problems.1.title'),
      description: t('problem.problems.1.description'),
    },
    {
      icon: Clock,
      title: t('problem.problems.2.title'),
      description: t('problem.problems.2.description'),
    },
  ];

  return (
    <section className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 to-zinc-950" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            {t('problem.title')}
          </h2>
          <p className="text-zinc-400 text-lg">{t('problem.subtitle')}</p>
        </motion.div>

        {/* Problems Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {problems.map((problem, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group relative"
            >
              <div className="relative p-6 rounded-2xl bg-gradient-to-b from-zinc-800/50 to-zinc-900/50 border border-zinc-800/50 hover:border-red-500/30 transition-all duration-300">
                {/* Icon */}
                <div className="w-14 h-14 rounded-xl bg-red-500/10 flex items-center justify-center mb-4">
                  <problem.icon className="w-7 h-7 text-red-400" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-white mb-3">
                  {problem.title}
                </h3>
                <p className="text-zinc-400 leading-relaxed">
                  {problem.description}
                </p>

                {/* Hover effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}