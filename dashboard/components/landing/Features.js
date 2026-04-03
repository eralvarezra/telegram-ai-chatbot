'use client';

import { useI18n } from '@/src/i18n';
import { motion } from 'framer-motion';
import { MessageSquare, TrendingUp, Palette, Users, Clock, HelpCircle } from 'lucide-react';
import { useState } from 'react';

export default function Features() {
  const { t } = useI18n();
  const [hoveredFeature, setHoveredFeature] = useState(null);

  const features = [
    {
      id: 'aiConversations',
      icon: MessageSquare,
      title: t('features.items.aiConversations.title'),
      description: t('features.items.aiConversations.description'),
      tooltip: t('features.items.aiConversations.tooltip'),
      color: 'blue',
    },
    {
      id: 'smartSales',
      icon: TrendingUp,
      title: t('features.items.smartSales.title'),
      description: t('features.items.smartSales.description'),
      tooltip: t('features.items.smartSales.tooltip'),
      color: 'green',
    },
    {
      id: 'toneMatching',
      icon: Palette,
      title: t('features.items.toneMatching.title'),
      description: t('features.items.toneMatching.description'),
      tooltip: t('features.items.toneMatching.tooltip'),
      color: 'purple',
    },
    {
      id: 'crmTracking',
      icon: Users,
      title: t('features.items.crmTracking.title'),
      description: t('features.items.crmTracking.description'),
      tooltip: t('features.items.crmTracking.tooltip'),
      color: 'orange',
    },
    {
      id: 'followUps',
      icon: Clock,
      title: t('features.items.followUps.title'),
      description: t('features.items.followUps.description'),
      tooltip: t('features.items.followUps.tooltip'),
      color: 'pink',
    },
  ];

  const colorClasses = {
    blue: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      text: 'text-blue-400',
      hover: 'hover:border-blue-500/40',
    },
    green: {
      bg: 'bg-green-500/10',
      border: 'border-green-500/20',
      text: 'text-green-400',
      hover: 'hover:border-green-500/40',
    },
    purple: {
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
      text: 'text-purple-400',
      hover: 'hover:border-purple-500/40',
    },
    orange: {
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/20',
      text: 'text-orange-400',
      hover: 'hover:border-orange-500/40',
    },
    pink: {
      bg: 'bg-pink-500/10',
      border: 'border-pink-500/20',
      text: 'text-pink-400',
      hover: 'hover:border-pink-500/40',
    },
  };

  return (
    <section id="features" className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-zinc-950" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-600/5 via-transparent to-transparent" />

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
            {t('features.title')}
          </h2>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            {t('features.subtitle')}
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative group"
              onMouseEnter={() => setHoveredFeature(feature.id)}
              onMouseLeave={() => setHoveredFeature(null)}
            >
              <div
                className={`relative p-6 rounded-2xl bg-zinc-900/50 border ${colorClasses[feature.color].border} ${colorClasses[feature.color].hover} transition-all duration-300 h-full`}
              >
                {/* Icon */}
                <div
                  className={`w-14 h-14 rounded-xl ${colorClasses[feature.color].bg} flex items-center justify-center mb-4`}
                >
                  <feature.icon className={`w-7 h-7 ${colorClasses[feature.color].text}`} />
                </div>

                {/* Title with tooltip icon */}
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
                  <div className="relative">
                    <HelpCircle className="w-4 h-4 text-zinc-500 cursor-help" />
                  </div>
                </div>

                {/* Description */}
                <p className="text-zinc-400 leading-relaxed">{feature.description}</p>

                {/* Tooltip */}
                {hoveredFeature === feature.id && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute left-0 right-0 -bottom-4 z-10 px-4"
                  >
                    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-300 shadow-xl">
                      {feature.tooltip}
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}