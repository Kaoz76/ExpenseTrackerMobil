import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';

const ThemeContext = createContext(null);

// GELİŞTİRME 1: Sistem temasını otomatik algılama
const getInitialTheme = () => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    return savedTheme; // Önce kullanıcının kaydettiği ayara bak
  }

  // Kayıtlı ayar yoksa, işletim sisteminin (Android/iOS/Windows) karanlık modda olup olmadığını kontrol et
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'light'; // Hiçbiri yoksa varsayılan aydınlık mod
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getInitialTheme);

  // GELİŞTİRME 2: Fonksiyonu hafızaya sabitleme (useCallback)
  const toggleTheme = useCallback(() => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  }, []);

  useEffect(() => {
    // Bootstrap 5 için HTML etiketine temayı işle
    document.documentElement.setAttribute('data-bs-theme', theme);
    // Tercihi yerel depolamaya kaydet
    localStorage.setItem('theme', theme);
  }, [theme]);

  // GELİŞTİRME 2: Gereksiz renderları önlemek için value objesini sarmalama (useMemo)
  const value = useMemo(() => ({
    theme,
    toggleTheme
  }), [theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  return useContext(ThemeContext);
};