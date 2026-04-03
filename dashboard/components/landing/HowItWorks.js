'use client';

import { useI18n } from '@/src/i18n';
import { motion } from 'framer-motion';
import { Link2, Brain, TrendingUp } from 'lucide-react';

export default function HowItWorks() {
  const { t } = useI18n();

  const steps = [
    {
      number: t('howItWorks.steps.0.number'),
      title: t('howItWorks.steps.0.title'),
      description: t('howItWorks.steps.0.description'),
      icon: Link2,
      color: 'blue',
    },
    {
      number: t('howItWorks.steps.1.number'),
      title: t('howItWorks.steps.1.title'),
      description: t('howItWorks.steps.1.description'),
      icon: Brain,
      color: 'purple',
    },
    {
      number: t('howItWorks.steps.2.number'),
      title: t('howItWorks.steps.2.title'),
      description: t('howItWorks.steps.2.description'),
      icon: TrendingUp,
      color: 'green',
    },
  ];

  const colorClasses = {
    blue: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      text: 'text-blue-400',
      number: 'text-blue-500/20',
    },
    purple: {
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
      text: 'text-purple-400',
      number: 'text-purple-500/20',
    },
    green: {
      bg: 'bg-green-500/10',
      border: 'border-green-500/20',
      text: 'text-green-400',
      number: 'text-green-500/20',
    },
  };

  return (
    <section className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950" />

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
            {t('howItWorks.title')}
          </h2>
          <p className="text-zinc-400 text-lg">{t('howItWorks.subtitle')}</p>
        </motion.div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-20 left-1/6 right-1/6 h-0.5 bg-gradient-to-r from-blue-500/50 via-purple-500/50 to-green-500/50" />

          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
              className="relative text-center"
            >
              {/* Number background */}
              <div
                className={`absolute inset-0 flex items-center justify-center pointer-events-none`}
              >
                <span
                  className={`text-[120px] font-bold ${colorClasses[step.color].number} select-none`}
                >
                  {step.number}
                </span>
              </div>

              {/* Content */}
              <div className="relative z-10 pt-24">
                {/* Icon */}
                <div
                  className={`w-16 h-16 mx-auto rounded-2xl ${colorClasses[step.color].bg} border ${colorClasses[step.color].border} flex items-center justify-center mb-6`}
                >
                  <step.icon className={`w-8 h-8 ${colorClasses[step.color].text}`} />
                </div>

                {/* Title */}
                <h3 className="text-xl font-semibold text-white mb-3">{step.title}</h3>

                {/* Description */}
                <p className="text-zinc-400 leading-relaxed max-w-xs mx-auto">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}