import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const CurrencyContext = createContext();

// Desteklenen para birimleri haritası (Geliştirme 3)
const CURRENCY_MAP = {
  TRY: { code: 'TRY', symbol: '₺', locale: 'tr-TR' },
  EUR: { code: 'EUR', symbol: '€', locale: 'de-DE' },
  GBP: { code: 'GBP', symbol: '£', locale: 'en-GB' },
  JPY: { code: 'JPY', symbol: '¥', locale: 'ja-JP' },
  USD: { code: 'USD', symbol: '$', locale: 'en-US' }
};

export const CurrencyProvider = ({ children }) => {
  const { user } = useAuth();

  // Başlangıçta localStorage'a bak (Geliştirme 2: Güvenli JSON.parse)
  const [currency, setCurrency] = useState(() => {
    try {
      const saved = localStorage.getItem('app_currency');
      return saved ? JSON.parse(saved) : CURRENCY_MAP['USD'];
    } catch (error) {
      console.error("Local storage parse error, resetting currency", error);
      return CURRENCY_MAP['USD'];
    }
  });

  // KULLANICI GİRİŞ YAPINCA TERCİHİNİ ÇEK
  useEffect(() => {
    if (user) {
      const fetchUserCurrency = async () => {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists() && docSnap.data().currency) {
            const dbCurrency = docSnap.data().currency;
            // Güvenli parse: string olarak kaydedilmişse veya eksik alanları varsa CURRENCY_MAP'ten çöz
            let resolvedCurrency;
            if (typeof dbCurrency === 'string') {
              // Eski format: sadece kod string olarak kayıtlıysa
              resolvedCurrency = CURRENCY_MAP[dbCurrency] || CURRENCY_MAP['USD'];
            } else if (dbCurrency.code && CURRENCY_MAP[dbCurrency.code]) {
              // Doğru format ama eksik alan olabilir — haritadan tam objeyi al
              resolvedCurrency = CURRENCY_MAP[dbCurrency.code];
            } else {
              resolvedCurrency = CURRENCY_MAP['USD'];
            }
            setCurrency(resolvedCurrency);
            localStorage.setItem('app_currency', JSON.stringify(resolvedCurrency));
          }
        } catch (error) {
          console.error("Error fetching currency preference:", error);
        }
      };
      fetchUserCurrency();
    }
  }, [user]);

  // GÜNCELLEME VE KAYDETME FONKSİYONU (Geliştirme 1: useCallback)
  const updateCurrency = useCallback(async (code) => {
    // Seçilen koda göre objeyi oluştur (Switch/Case yerine haritadan çekiyoruz)
    const newCurrency = CURRENCY_MAP[code] || CURRENCY_MAP['USD'];

    setCurrency(newCurrency);
    localStorage.setItem('app_currency', JSON.stringify(newCurrency));

    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid), {
          currency: newCurrency
        }, { merge: true });
      } catch (error) {
        console.error("Error saving currency preference:", error);
      }
    }
  }, [user]); // user bağımlılığı eklendi

  // Fiyat formatlama yardımcısı (Geliştirme 1: useCallback)
  const formatPrice = useCallback((amount) => {
    const validAmount = Number(amount) || 0;
    const safeCurrencyCode = (currency && currency.code) ? currency.code : 'USD';
    const safeLocale = (currency && currency.locale) ? currency.locale : 'en-US';

    try {
      return new Intl.NumberFormat(safeLocale, {
        style: 'currency',
        currency: safeCurrencyCode
      }).format(validAmount);
    } catch (error) {
      const fallbackSymbol = (currency && currency.symbol) ? currency.symbol : '$';
      return `${fallbackSymbol}${validAmount.toFixed(2)}`;
    }
  }, [currency]); // currency bağımlılığı eklendi

  // Gereksiz render'ları önlemek için value objesini hafızaya alıyoruz (Geliştirme 1: useMemo)
  const contextValue = useMemo(() => ({
    currency,
    updateCurrency,
    formatPrice
  }), [currency, updateCurrency, formatPrice]);

  return (
    <CurrencyContext.Provider value={contextValue}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => useContext(CurrencyContext);