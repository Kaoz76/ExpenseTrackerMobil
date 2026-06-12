import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

import { useLanguage } from './LanguageContext';

const CurrencyContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const CURRENCY_MAP = {
  TRY: { code: 'TRY', symbol: '₺', locale: 'tr-TR' },
  EUR: { code: 'EUR', symbol: '€', locale: 'de-DE' },
  GBP: { code: 'GBP', symbol: '£', locale: 'en-GB' },
  USD: { code: 'USD', symbol: '$', locale: 'en-US' }
};

// API kapalıysa ve önbellek yoksa kullanılacak USD tabanlı sabit kurlar
const STATIC_USD_RATES = {
  USD: 1.0,
  TRY: 32.5,
  EUR: 0.92,
  GBP: 0.79,
};

const CACHE_KEY = 'currency_rates_cache';
const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 saatlik önbellek

export const CurrencyProvider = ({ children }) => {
  const { user } = useAuth();
  const { language } = useLanguage();

  // Ana para birimini yükle
  const [currency, setCurrency] = useState(() => {
    try {
      const saved = localStorage.getItem('app_currency');
      return saved ? JSON.parse(saved) : CURRENCY_MAP['USD'];
    } catch (error) {
      console.error("Local storage parse error, resetting currency", error);
      return CURRENCY_MAP['USD'];
    }
  });

  // Favori para birimlerini yükle
  const [favoriteCurrencies, setFavoriteCurrencies] = useState(() => {
    try {
      const saved = localStorage.getItem('favorite_currencies');
      return saved ? JSON.parse(saved) : ['USD', 'EUR', 'TRY'];
    } catch {
      return ['USD', 'EUR', 'TRY'];
    }
  });

  // Kurlar ve yüklenme durumu
  const [rates, setRates] = useState({});
  const [ratesLoading, setRatesLoading] = useState(true);

  // API kapalı ve önbellek boş olduğunda yerel yedek kurları hesapla
  const getFallbackRates = useCallback((baseCode) => {
    const fallback = {};
    const baseUsdRate = STATIC_USD_RATES[baseCode] || 1.0;
    Object.keys(STATIC_USD_RATES).forEach(code => {
      fallback[code] = STATIC_USD_RATES[code] / baseUsdRate;
    });
    return fallback;
  }, []);

  // Döviz kurlarını getir
  const fetchRates = useCallback(async (baseCode) => {
    setRatesLoading(true);
    try {
      // 1. Önce yerel önbelleği kontrol et
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const cacheData = JSON.parse(cached);
        const age = Date.now() - cacheData.timestamp;
        if (age < CACHE_DURATION && cacheData.base === baseCode && cacheData.rates) {
          setRates(cacheData.rates);
          setRatesLoading(false);
          return;
        }
      }

      // 2. Ücretsiz açık döviz kuru API'sinden veri çek
      const res = await fetch(`https://open.er-api.com/v6/latest/${baseCode}`);
      if (!res.ok) throw new Error("API request failed");
      const data = await res.json();
      
      if (data.result === 'success' && data.rates) {
        setRates(data.rates);
        // Önbelleğe kaydet
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          timestamp: Date.now(),
          base: baseCode,
          rates: data.rates
        }));
      } else {
        throw new Error("Invalid API response format");
      }
    } catch (error) {
      console.warn("Could not fetch online exchange rates, using local cache or fallbacks:", error);
      
      // Yedek 1: Taban eşleşiyorsa süresi dolmuş önbelleği dene
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const cacheData = JSON.parse(cached);
        if (cacheData.base === baseCode && cacheData.rates) {
          setRates(cacheData.rates);
          setRatesLoading(false);
          return;
        }
      }

      // Yedek 2: Sabit USD kurlarını kullanarak yedek kurlar oluştur
      const fallback = getFallbackRates(baseCode);
      setRates(fallback);
    } finally {
      setRatesLoading(false);
    }
  }, [getFallbackRates]);

  // Ana para birimi değiştiğinde kurları getir
  useEffect(() => {
    if (currency?.code) {
      fetchRates(currency.code);
    }
  }, [currency?.code, fetchRates]);

  // Giriş yapıldığında kullanıcı tercihlerini getir
  useEffect(() => {
    if (user) {
      const fetchUserPreferences = async () => {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Ana para birimini çözümle
            if (data.currency) {
              const dbCurrency = data.currency;
              let resolvedCurrency;
              if (typeof dbCurrency === 'string') {
                resolvedCurrency = CURRENCY_MAP[dbCurrency] || CURRENCY_MAP['USD'];
              } else if (dbCurrency.code && CURRENCY_MAP[dbCurrency.code]) {
                resolvedCurrency = CURRENCY_MAP[dbCurrency.code];
              } else {
                resolvedCurrency = CURRENCY_MAP['USD'];
              }
              setCurrency(resolvedCurrency);
              localStorage.setItem('app_currency', JSON.stringify(resolvedCurrency));
            }

            // Favori para birimlerini çözümle
            if (data.favoriteCurrencies && Array.isArray(data.favoriteCurrencies)) {
              setFavoriteCurrencies(data.favoriteCurrencies);
              localStorage.setItem('favorite_currencies', JSON.stringify(data.favoriteCurrencies));
            }
          }
        } catch (error) {
          console.error("Error fetching currency preferences:", error);
        }
      };
      fetchUserPreferences();
    }
  }, [user]);

  // Ana para birimini güncelle
  const updateCurrency = useCallback(async (code) => {
    const newCurrency = CURRENCY_MAP[code] || CURRENCY_MAP['USD'];

    setCurrency(newCurrency);
    localStorage.setItem('app_currency', JSON.stringify(newCurrency));

    // Yeni ana para birimini favorilere otomatik ekle (yoksa)
    setFavoriteCurrencies(prev => {
      if (!prev.includes(code)) {
        const updated = [...prev, code];
        localStorage.setItem('favorite_currencies', JSON.stringify(updated));
        if (user) {
          setDoc(doc(db, "users", user.uid), { favoriteCurrencies: updated }, { merge: true });
        }
        return updated;
      }
      return prev;
    });

    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid), {
          currency: newCurrency
        }, { merge: true });
      } catch (error) {
        console.error("Error saving primary currency:", error);
      }
    }
  }, [user]);

  // Favori para birimlerini güncelle
  const updateFavoriteCurrencies = useCallback(async (codes) => {
    // Favorileri geçerli tut (CURRENCY_MAP'te olanları içermeli)
    const validCodes = codes.filter(code => CURRENCY_MAP[code]);
    
    // Ana para biriminin HER ZAMAN favorilerde olmasını sağla
    if (currency?.code && !validCodes.includes(currency.code)) {
      validCodes.push(currency.code);
    }

    setFavoriteCurrencies(validCodes);
    localStorage.setItem('favorite_currencies', JSON.stringify(validCodes));

    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid), {
          favoriteCurrencies: validCodes
        }, { merge: true });
      } catch (error) {
        console.error("Error saving favorite currencies:", error);
      }
    }
  }, [user, currency?.code]);

  // Para birimi dönüştürme aracı
  const convertPrice = useCallback((amount, fromCode, toCode) => {
    const val = Number(amount) || 0;
    if (fromCode === toCode) return val;

    // Taban para birimine göre güncel kurları kullan
    const baseCode = currency?.code || 'USD';
    const activeRates = rates && Object.keys(rates).length > 0 ? rates : getFallbackRates(baseCode);

    const fromRate = activeRates[fromCode];
    const toRate = activeRates[toCode];

    // Her iki kur da tanımlıysa dönüştür
    if (fromRate && toRate) {
      const amountInBase = fromCode === baseCode ? val : val / fromRate;
      return toCode === baseCode ? amountInBase : amountInBase * toRate;
    }

    // Doğrudan sabit kurları kullanan ikincil yedek
    const fromStatic = STATIC_USD_RATES[fromCode] || 1.0;
    const toStatic = STATIC_USD_RATES[toCode] || 1.0;
    const amountInUsd = val / fromStatic;
    return amountInUsd * toStatic;
  }, [currency?.code, rates, getFallbackRates]);

  // Fiyat formatlama yardımcısı
  const formatPrice = useCallback((amount, specificCurrencyCode = null) => {
    const validAmount = Number(amount) || 0;
    
    // Hangi para birimi formatlamasının kullanılacağını belirle
    const targetCode = specificCurrencyCode || (currency && currency.code) || 'USD';
    const targetMeta = CURRENCY_MAP[targetCode] || CURRENCY_MAP['USD'];
    const activeLocale = language === 'tr' ? targetMeta.locale : 'en-US';

    try {
      return new Intl.NumberFormat(activeLocale, {
        style: 'currency',
        currency: targetMeta.code
      }).format(validAmount);
    } catch {
      return `${targetMeta.symbol}${validAmount.toFixed(2)}`;
    }
  }, [currency, language]);

  const contextValue = useMemo(() => ({
    currency,
    favoriteCurrencies,
    rates,
    ratesLoading,
    updateCurrency,
    updateFavoriteCurrencies,
    convertPrice,
    formatPrice
  }), [currency, favoriteCurrencies, rates, ratesLoading, updateCurrency, updateFavoriteCurrencies, convertPrice, formatPrice]);

  return (
    <CurrencyContext.Provider value={contextValue}>
      {children}
    </CurrencyContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useCurrency = () => useContext(CurrencyContext);