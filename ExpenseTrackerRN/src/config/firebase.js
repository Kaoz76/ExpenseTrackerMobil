import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAjJnFJy8cgO9Up_RlajN2XAnhZxHMo0Us",
  authDomain: "expense-tracker-18300.firebaseapp.com",
  projectId: "expense-tracker-18300",
  storageBucket: "expense-tracker-18300.firebasestorage.app",
  messagingSenderId: "489249914220",
  appId: "1:489249914220:web:4edd80707af54627564749",
  measurementId: "G-FDQQB6Q270"
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
