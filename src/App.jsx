import React, { useEffect, useState, Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import ScrollToHash from './components/ScrollToHash';
import DynamicFavicon from './components/DynamicFavicon';
import ScrollToTopButton from './components/ScrollToTopButton';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Landing = lazy(() => import('./pages/Landing'));
const Receipts = lazy(() => import('./pages/Receipts'));
const ManualEntry = lazy(() => import('./pages/ManualEntry'));
const Subscriptions = lazy(() => import('./pages/Subscriptions'));
const Products = lazy(() => import('./pages/Products'));
const ProductDetails = lazy(() => import('./pages/ProductDetails'));
const ReceiptDetail = lazy(() => import('./pages/ReceiptDetail'));
const Stores = lazy(() => import('./pages/Stores'));
const StoreDetails = lazy(() => import('./pages/StoreDetails'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignUpPage = lazy(() => import('./pages/SignUpPage'));
const AnalyzeExpenses = lazy(() => import('./pages/AnalyzeExpenses'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));

const PageLoader = () => (
  <div className="d-flex justify-content-center align-items-center w-100" style={{ minHeight: '60vh' }}>
    <div className="spinner-border text-primary" role="status">
      <span className="visually-hidden">Yükleniyor...</span>
    </div>
  </div>
);

const checkIsMobile = () => {
  // 1. Klasik Mobil Tarayıcı Kontrolü
  const isMobileUA = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // 2. Masaüstü/Dokunmatik Bilgisayar Ayrımı
  const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const hasMouse = window.matchMedia('(pointer: fine)').matches; // Cihazda bir fare/touchpad var mı?
  
  // Eğer cihaz dokunmatikse AMA faresi YOKSA, bu kesinlikle bir tablet veya telefondur.
  // (Böylece dokunmatik ekranlı Windows bilgisayarlar mobil sanılmaz!)
  const isPureTouchDevice = hasTouch && !hasMouse;

  return window.innerWidth < 768 && (isMobileUA || isPureTouchDevice);
};

function App() {
  const [isMobile, setIsMobile] = useState(checkIsMobile());

  useEffect(() => {
    const handleResize = () => setIsMobile(checkIsMobile());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <ErrorBoundary>
      <div>
        <ScrollToHash />
      <DynamicFavicon />
      <ScrollToTopButton />

      <Navbar />

      {/* Capacitor "Safe Area" destekli mobil boşluk mantığı mükemmel çalışıyor */}
      <main className="main-content-area">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* 🔥 Kök dizin (/) mobil uygulamada Dashboard'a yönlendirilir, web'de Landing gösterilir */}
            <Route path="/" element={isMobile ? <Navigate to="/dashboard" replace /> : <Landing />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

            <Route path="/receipts" element={<ProtectedRoute><Receipts /></ProtectedRoute>} />
            <Route path="/receipts/:receiptId" element={<ProtectedRoute><ReceiptDetail /></ProtectedRoute>} />
            <Route path="/texts" element={<ProtectedRoute><ManualEntry /></ProtectedRoute>} />
            <Route path="/subscriptions" element={<ProtectedRoute><Subscriptions /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
            <Route path="/products/:productId" element={<ProtectedRoute><ProductDetails /></ProtectedRoute>} />
            <Route path="/stores" element={<ProtectedRoute><Stores /></ProtectedRoute>} />
            <Route path="/stores/:storeId" element={<ProtectedRoute><StoreDetails /></ProtectedRoute>} />

            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />

            {/* Quick Links */}
            <Route path="/analyze" element={<ProtectedRoute><AnalyzeExpenses /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

            {/* 🔥 GELİŞTİRME 2: 404 Catch-All (Bilinmeyen bir URL girilirse ana sayfaya yönlendir) */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      <BottomNav />
      </div>
    </ErrorBoundary>
  );
}

export default App;