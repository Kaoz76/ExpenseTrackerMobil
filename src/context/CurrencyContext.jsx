import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const CurrencyContext = createContext();

export const CURRENCY_MAP = {
  TRY: { code: 'TRY', symbol: '₺', locale: 'tr-TR' },
  EUR: { code: 'EUR', symbol: '€', locale: 'de-DE' },
  GBP: { code: 'GBP', symbol: '£', locale: 'en-GB' },
  JPY: { code: 'JPY', symbol: '¥', locale: 'ja-JP' },
  USD: { code: 'USD', symbol: '$', locale: 'en-US' }
};

// Static rates with USD as pivot to use if API is offline and no cache is present
const STATIC_USD_RATES = {
  USD: 1.0,
  TRY: 32.5,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 155.0
};

const CACHE_KEY = 'currency_rates_cache';
const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours cache

export const CurrencyProvider = ({ children }) => {
  const { user } = useAuth();

  // Load Primary Currency
  const [currency, setCurrency] = useState(() => {
    try {
      const saved = localStorage.getItem('app_currency');
      return saved ? JSON.parse(saved) : CURRENCY_MAP['USD'];
    } catch (error) {
      console.error("Local storage parse error, resetting currency", error);
      return CURRENCY_MAP['USD'];
    }
  });

  // Load Favorite Currencies
  const [favoriteCurrencies, setFavoriteCurrencies] = useState(() => {
    try {
      const saved = localStorage.getItem('favorite_currencies');
      return saved ? JSON.parse(saved) : ['USD', 'EUR', 'TRY'];
    } catch (error) {
      return ['USD', 'EUR', 'TRY'];
    }
  });

  // Rates and Loading State
  const [rates, setRates] = useState({});
  const [ratesLoading, setRatesLoading] = useState(true);

  // Helper to compute local fallback rates when API is offline and cache is empty
  const getFallbackRates = useCallback((baseCode) => {
    const fallback = {};
    const baseUsdRate = STATIC_USD_RATES[baseCode] || 1.0;
    Object.keys(STATIC_USD_RATES).forEach(code => {
      fallback[code] = STATIC_USD_RATES[code] / baseUsdRate;
    });
    return fallback;
  }, []);

  // Fetch Exchange Rates
  const fetchRates = useCallback(async (baseCode) => {
    setRatesLoading(true);
    try {
      // 1. Check local storage cache first
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

      // 2. Fetch from free public exchange rate API
      const res = await fetch(`https://open.er-api.com/v6/latest/${baseCode}`);
      if (!res.ok) throw new Error("API request failed");
      const data = await res.json();
      
      if (data.result === 'success' && data.rates) {
        setRates(data.rates);
        // Save to cache
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
      
      // Fallback 1: Try expired cache if base matches
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const cacheData = JSON.parse(cached);
        if (cacheData.base === baseCode && cacheData.rates) {
          setRates(cacheData.rates);
          setRatesLoading(false);
          return;
        }
      }

      // Fallback 2: Generate fallback rates using static USD rates pivot
      const fallback = getFallbackRates(baseCode);
      setRates(fallback);
    } finally {
      setRatesLoading(false);
    }
  }, [getFallbackRates]);

  // Fetch rates whenever the primary currency changes
  useEffect(() => {
    if (currency?.code) {
      fetchRates(currency.code);
    }
  }, [currency?.code, fetchRates]);

  // Fetch User Preferences on Login
  useEffect(() => {
    if (user) {
      const fetchUserPreferences = async () => {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Resolve primary currency
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

            // Resolve favorite currencies
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

  // Update Primary Currency
  const updateCurrency = useCallback(async (code) => {
    const newCurrency = CURRENCY_MAP[code] || CURRENCY_MAP['USD'];

    setCurrency(newCurrency);
    localStorage.setItem('app_currency', JSON.stringify(newCurrency));

    // Auto-add new primary currency to favorites if not already present
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

  // Update Favorite Currencies
  const updateFavoriteCurrencies = useCallback(async (codes) => {
    // Keep favorites valid (must contain currency codes present in CURRENCY_MAP)
    const validCodes = codes.filter(code => CURRENCY_MAP[code]);
    
    // Ensure primary currency is ALWAYS in the favorites
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

  // Currency Converter Utility
  const convertPrice = useCallback((amount, fromCode, toCode) => {
    const val = Number(amount) || 0;
    if (fromCode === toCode) return val;

    // Use current rates relative to the base currency
    const baseCode = currency?.code || 'USD';
    const activeRates = rates && Object.keys(rates).length > 0 ? rates : getFallbackRates(baseCode);

    const fromRate = activeRates[fromCode];
    const toRate = activeRates[toCode];

    // If both rates are defined, convert using pivot
    if (fromRate && toRate) {
      const amountInBase = fromCode === baseCode ? val : val / fromRate;
      return toCode === baseCode ? amountInBase : amountInBase * toRate;
    }

    // Secondary fallback using direct static rates
    const fromStatic = STATIC_USD_RATES[fromCode] || 1.0;
    const toStatic = STATIC_USD_RATES[toCode] || 1.0;
    const amountInUsd = val / fromStatic;
    return amountInUsd * toStatic;
  }, [currency?.code, rates, getFallbackRates]);

  // Format Price Helper
  const formatPrice = useCallback((amount, specificCurrencyCode = null) => {
    const validAmount = Number(amount) || 0;
    
    // Determine which currency formatting metadata to use
    const targetCode = specificCurrencyCode || (currency && currency.code) || 'USD';
    const targetMeta = CURRENCY_MAP[targetCode] || CURRENCY_MAP['USD'];

    try {
      return new Intl.NumberFormat(targetMeta.locale, {
        style: 'currency',
        currency: targetMeta.code
      }).format(validAmount);
    } catch (error) {
      return `${targetMeta.symbol}${validAmount.toFixed(2)}`;
    }
  }, [currency]);

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

export const useCurrency = () => useContext(CurrencyContext);