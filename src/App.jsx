import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import ScrollToHash from './components/ScrollToHash';
import DynamicFavicon from './components/DynamicFavicon';
import ScrollToTopButton from './components/ScrollToTopButton';

import Dashboard from './pages/Dashboard';
import Landing from './pages/Landing';
import Receipts from './pages/Receipts';
import ManualEntry from './pages/ManualEntry';
import Subscriptions from './pages/Subscriptions';
import Products from './pages/Products';
import ProductDetails from './pages/ProductDetails';
import ReceiptDetail from './pages/ReceiptDetail';
import Stores from './pages/Stores';
import StoreDetails from './pages/StoreDetails';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import AnalyzeExpenses from './pages/AnalyzeExpenses';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div>
      <ScrollToHash />
      <DynamicFavicon />
      <ScrollToTopButton />

      <Navbar />

      {/* Capacitor "Safe Area" destekli mobil boşluk mantığı mükemmel çalışıyor */}
      <main style={{ paddingBottom: isMobile ? 'calc(70px + env(safe-area-inset-bottom))' : '0' }}>
        <Routes>
          {/* 🔥 Kök dizin (/) mobil uygulamada Dashboard'a yönlendirilir, web'de Landing gösterilir */}
          <Route path="/" element={isMobile ? <Navigate to="/dashboard" replace /> : <Landing />} />
          <Route path="/dashboard" element={<Dashboard />} />

          <Route path="/receipts" element={<Receipts />} />
          <Route path="/receipts/:receiptId" element={<ReceiptDetail />} />
          <Route path="/texts" element={<ManualEntry />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:productId" element={<ProductDetails />} />
          <Route path="/stores" element={<Stores />} />
          <Route path="/stores/:storeId" element={<StoreDetails />} />

          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />

          {/* Quick Links */}
          <Route path="/analyze" element={<AnalyzeExpenses />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />

          {/* 🔥 GELİŞTİRME 2: 404 Catch-All (Bilinmeyen bir URL girilirse Dashboard'a geri fırlat) */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>

      <BottomNav />
    </div>
  );
}

export default App;