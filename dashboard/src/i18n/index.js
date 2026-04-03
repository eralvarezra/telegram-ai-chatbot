'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { locales, defaultLocale, localeNames } from './config';

const I18nContext = createContext(null);

const translations = {
  en: () => import('../../messages/en.json').then(m => m.default),
  es: () => import('../../messages/es.json').then(m => m.default)
};

export function I18nProvider({ children }) {
  const [locale, setLocale] = useState(defaultLocale);
  const [messages, setMessages] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load saved locale from localStorage
    const savedLocale = localStorage.getItem('locale');
    if (savedLocale && locales.includes(savedLocale)) {
      setLocale(savedLocale);
    } else {
      // Detect browser language
      const browserLang = navigator.language.split('-')[0];
      if (locales.includes(browserLang)) {
        setLocale(browserLang);
      }
    }
  }, []);

  useEffect(() => {
    // Load translations
    const loadTranslations = async () => {
      setLoading(true);
      const msgs = await translations[locale]();
      setMessages(msgs);
      setLoading(false);
    };
    loadTranslations();
  }, [locale]);

  const changeLocale = (newLocale) => {
    if (locales.includes(newLocale)) {
      setLocale(newLocale);
      localStorage.setItem('locale', newLocale);
      document.documentElement.lang = newLocale;
    }
  };

  const t = (key) => {
    if (!messages) return key;
    const keys = key.split('.');
    let value = messages;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key;
      }
    }
    return typeof value === 'string' ? value : key;
  };

  return (
    <I18nContext.Provider value={{ locale, messages, t, changeLocale, localeNames, locales, loading }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}

export { locales, defaultLocale, localeNames };