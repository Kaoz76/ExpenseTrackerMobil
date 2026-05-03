import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { auth } from '../firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'firebase/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // GELİŞTİRME 1: Fonksiyonları hafızada sabitlemek için useCallback kullanıyoruz
  const signup = useCallback((email, password) => {
    return createUserWithEmailAndPassword(auth, email, password);
  }, []);

  const login = useCallback((email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  }, []);

  const logout = useCallback(() => {
    return signOut(auth);
  }, []);

  const resetPassword = useCallback((email) => {
    return sendPasswordResetEmail(auth, email);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });

    // Component unmount olduğunda (kapandığında) dinleyiciyi temizle
    return () => unsubscribe(); // (Okunabilirliği artırmak için tek satıra indirildi)
  }, []);

  // GELİŞTİRME 1: Uygulama genelinde gereksiz renderları önlemek için useMemo
  const value = useMemo(() => ({
    user,
    signup,
    login,
    logout,
    resetPassword
  }), [user, signup, login, logout, resetPassword]);

  // GELİŞTİRME 2: Boş beyaz ekran yerine şık bir bekleme (Loading) UI'ı göster
  if (loadingAuth) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-body-tertiary">
        <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; // <-- AuthProvider fonksiyonu burada bitti!

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  return useContext(AuthContext);
};