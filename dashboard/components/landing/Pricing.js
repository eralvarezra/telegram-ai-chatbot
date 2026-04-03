'use client';

import { useI18n } from '@/src/i18n';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

export default function Pricing() {
  const { t } = useI18n();

  const plans = [
    {
      id: 'free',
      name: t('pricing.plans.free.name'),
      price: t('pricing.plans.free.price'),
      description: t('pricing.plans.free.description'),
      features: [
        t('pricing.plans.free.features.0'),
        t('pricing.plans.free.features.1'),
        t('pricing.plans.free.features.2'),
        t('pricing.plans.free.features.3'),
      ],
      cta: t('pricing.plans.free.cta'),
      popular: false,
    },
    {
      id: 'pro',
      name: t('pricing.plans.pro.name'),
      price: t('pricing.plans.pro.price'),
      description: t('pricing.plans.pro.description'),
      features: [
        t('pricing.plans.pro.features.0'),
        t('pricing.plans.pro.features.1'),
        t('pricing.plans.pro.features.2'),
        t('pricing.plans.pro.features.3'),
        t('pricing.plans.pro.features.4'),
        t('pricing.plans.pro.features.5'),
      ],
      cta: t('pricing.plans.pro.cta'),
      popular: true,
    },
    {
      id: 'scale',
      name: t('pricing.plans.scale.name'),
      price: t('pricing.plans.scale.price'),
      description: t('pricing.plans.scale.description'),
      features: [
        t('pricing.plans.scale.features.0'),
        t('pricing.plans.scale.features.1'),
        t('pricing.plans.scale.features.2'),
        t('pricing.plans.scale.features.3'),
        t('pricing.plans.scale.features.4'),
        t('pricing.plans.scale.features.5'),
      ],
      cta: t('pricing.plans.scale.cta'),
      popular: false,
    },
  ];

  return (
    <section id="pricing" className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-zinc-950" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-blue-600/5 via-transparent to-transparent" />

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
            {t('pricing.title')}
          </h2>
          <p className="text-zinc-400 text-lg">{t('pricing.subtitle')}</p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`relative ${plan.popular ? 'md:-mt-4 md:mb-4' : ''}`}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-blue-600 text-white text-sm font-medium">
                  {t('pricing.popular')}
                </div>
              )}

              <div
                className={`h-full p-6 rounded-2xl ${
                  plan.popular
                    ? 'bg-gradient-to-b from-blue-600/20 to-zinc-900/50 border-2 border-blue-500/50'
                    : 'bg-zinc-900/50 border border-zinc-800'
                } transition-all duration-300 hover:scale-[1.02]`}
              >
                {/* Plan name */}
                <h3 className="text-xl font-semibold text-white mb-2">{plan.name}</h3>
                <p className="text-zinc-500 text-sm mb-4">{plan.description}</p>

                {/* Price */}
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">${plan.price}</span>
                  <span className="text-zinc-500">/mo</span>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-green-400" />
                      </div>
                      <span className="text-zinc-300 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <a
                  href="/login"
                  className={`block w-full py-3 rounded-xl text-center font-semibold transition-all ${
                    plan.popular
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-center text-zinc-500 text-sm"
        >
          {t('pricing.footer')}
        </motion.p>
      </div>
    </section>
  );
}