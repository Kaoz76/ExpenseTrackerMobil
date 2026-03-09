import React from 'react';
import { Routes, Route } from 'react-router-dom';

import Navbar from './components/Navbar';
import ScrollToHash from './components/ScrollToHash';
import DynamicFavicon from './components/DynamicFavicon';
import NotificationManager from './components/NotificationManager';
import ScrollToTopButton from './components/ScrollToTopButton';

import Dashboard from './pages/Dashboard';
import Receipts from './pages/Receipts';
import ManualEntry from './pages/ManualEntry';
import Subscriptions from './pages/Subscriptions';
import Products from './pages/Products';
import ProductDetails from './pages/ProductDetails';
import Stores from './pages/Stores';
import StoreDetails from './pages/StoreDetails';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import AnalyzeExpenses from './pages/AnalyzeExpenses';
import Reports from './pages/Reports';
import Settings from './pages/Settings';


function App() {
  return (
    <div>
      <ScrollToHash />
      <DynamicFavicon />
      <NotificationManager />
      <ScrollToTopButton />
      
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          
          <Route path="/receipts" element={<Receipts />} />
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
        </Routes>
      </main>
    </div>
  );
}

export default App;