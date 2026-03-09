import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function DynamicFavicon() {
  const location = useLocation();

  useEffect(() => {
    // Mevcut favicon elementini bul veya yoksa oluştur
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }

    // Varsayılan favicon (Eğer eşleşme olmazsa dashboard ikonu olsun)
    let faviconPath = '/dashboard-favicon.png'; 

    const path = location.pathname.toLowerCase();

    if (path.includes('receipts')) {
      faviconPath = '/scans-favicon.png';
    } else if (path.includes('texts')) {
      faviconPath = '/texts-favicon.png';
    } else if (path.includes('products')) {
      faviconPath = '/products-favicon.png';
    } else if (path.includes('stores')) {
      faviconPath = '/stores-favicon.png';
    } else if (path === '/' || path.includes('dashboard')) {
      faviconPath = '/dashboard-favicon.png';
    } else if (path.includes('analyze')) {
      faviconPath = '/analyze-expenses-favicon.png';
    } else if (path.includes('reports')) {
      faviconPath = '/view-reports-favicon.png';
    } else if (path.includes('settings')) {
      faviconPath = '/settings-favicon.png';
    } else if (path.includes('login')) {
      faviconPath = '/login-favicon.png';
    } else if (path.includes('signup')) {
      faviconPath = '/signup-favicon.png';
    }  
    
    // Favicon'u güncelle
    link.href = faviconPath;

  }, [location]); // URL (location) her değiştiğinde bu kod çalışır

  return null; // Bu bileşen ekrana bir şey çizmez
}

export default DynamicFavicon;