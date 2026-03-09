import React, { createContext, useState, useContext, useEffect } from 'react';
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

  const signup = (email, password) => {
    return createUserWithEmailAndPassword(auth, email, password);
  };

  const login = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = () => {
    return signOut(auth);
  };

  const resetPassword = (email) => {
    return sendPasswordResetEmail(auth, email);
  };

  // Bu, AuthContext'in kalbidir.
  // Kullanıcının giriş/çıkış durumunu sürekli dinler (sayfa yenilense bile)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser); 
      setLoadingAuth(false); 
    });

    // Component unmount olduğunda (kapandığında) dinleyiciyi temizle
    return () => {
      unsubscribe();
    };
  }, []);

  const value = { user, signup, login, logout, resetPassword };

  return (
    <AuthContext.Provider value={value}>
      {/* Kimlik durumu kontrol edilene kadar alt bileşenleri render etme */}
      {!loadingAuth && children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  return useContext(AuthContext);
};
