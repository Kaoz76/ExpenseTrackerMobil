import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { en } from '../locales/en.js';
import { tr } from '../locales/tr.js';

const LanguageContext = createContext();

const translations = { en, tr };

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('language');
    return saved || 'en';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.lang = language;
  }, [language]);

  const t = useCallback((key) => {
    const keys = key.split('.');
    let value = translations[language];
    for (const k of keys) {
      if (value && value[k] !== undefined) {
        value = value[k];
      } else {
        // Fallback to English if not found
        let fallbackValue = translations['en'];
        for (const fk of keys) {
          if (fallbackValue && fallbackValue[fk] !== undefined) {
            fallbackValue = fallbackValue[fk];
          } else {
            return key; // Tamamen bulunamazsa anahtarı döndür
          }
        }
        return fallbackValue || key;
      }
    }
    return value;
  }, [language]);

  const contextValue = useMemo(() => ({
    language,
    setLanguage,
    t
  }), [language, t]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useLanguage = () => useContext(LanguageContext);
