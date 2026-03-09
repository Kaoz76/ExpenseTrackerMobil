import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const CurrencyContext = createContext();

export const CurrencyProvider = ({ children }) => {
  const { user } = useAuth();
  
  // Başlangıçta localStorage'a bak (Hız için), yoksa varsayılan USD
  const [currency, setCurrency] = useState(() => {
    const saved = localStorage.getItem('app_currency');
    return saved ? JSON.parse(saved) : { code: 'USD', symbol: '$', locale: 'en-US' };
  });

  // KULLANICI GİRİŞ YAPINCA TERCİHİNİ ÇEK
  useEffect(() => {
    if (user) {
      const fetchUserCurrency = async () => {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists() && docSnap.data().currency) {
            // Veritabanında kayıtlı para birimi varsa onu kullan
            const dbCurrency = docSnap.data().currency;
            setCurrency(dbCurrency);
            // LocalStorage'ı da eşle
            localStorage.setItem('app_currency', JSON.stringify(dbCurrency));
          }
        } catch (error) {
          console.error("Error fetching currency preference:", error);
        }
      };
      fetchUserCurrency();
    }
  }, [user]);

  // GÜNCELLEME VE KAYDETME FONKSİYONU
  const updateCurrency = async (code) => {
    let newCurrency = { code: 'USD', symbol: '$', locale: 'en-US' };

    // Seçilen koda göre objeyi oluştur
    switch (code) {
      case 'TRY':
        newCurrency = { code: 'TRY', symbol: '₺', locale: 'tr-TR' };
        break;
      case 'EUR':
        newCurrency = { code: 'EUR', symbol: '€', locale: 'de-DE' };
        break;
      case 'GBP':
        newCurrency = { code: 'GBP', symbol: '£', locale: 'en-GB' };
        break;
      case 'JPY':
        newCurrency = { code: 'JPY', symbol: '¥', locale: 'ja-JP' };
        break;
      case 'USD':
      default:
        newCurrency = { code: 'USD', symbol: '$', locale: 'en-US' };
        break;
    }

    // State'i hemen güncelle (Anlık tepki için)
    setCurrency(newCurrency);
    
    // LocalStorage'a kaydet (Yedek)
    localStorage.setItem('app_currency', JSON.stringify(newCurrency));

    // Kullanıcı giriş yapmışsa Firestore'a kaydet
    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid), {
          currency: newCurrency
        }, { merge: true }); // Diğer verileri silmeden sadece currency'i güncelle
      } catch (error) {
        console.error("Error saving currency preference:", error);
      }
    }
  };

  // Fiyat formatlama yardımcısı
  const formatPrice = (amount) => {
    const num = Number(amount) || 0;
    return new Intl.NumberFormat(currency.locale, {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: 2
    }).format(num);
  };

  return (
    <CurrencyContext.Provider value={{ currency, updateCurrency, formatPrice }}>
      {children}
    </CurrencyContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useCurrency = () => useContext(CurrencyContext);