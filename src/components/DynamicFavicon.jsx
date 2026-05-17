import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

function DynamicFavicon() {
  const location = useLocation();
  const { t } = useLanguage();

  // Rotaları, Faviconları ve Sayfa Başlıklarını useMemo ile tanımlıyoruz ki 't' fonksiyonuna erişebilsin
  const routeConfig = useMemo(() => ({
    '/receipts': { icon: '/scans-favicon.png', title: t('nav.receipts') || 'Scans' },
    '/texts': { icon: '/texts-favicon.png', title: t('nav.manual_entry') || 'Add Entry' },
    '/products': { icon: '/products-favicon.png', title: t('nav.products') || 'Products' },
    '/stores': { icon: '/stores-favicon.png', title: t('nav.stores') || 'Stores' },
    '/subscriptions': { icon: '/dashboard-favicon.png', title: t('nav.subscriptions') || 'Subscriptions' },
    '/analyze': { icon: '/analyze-expenses-favicon.png', title: t('nav.analyze') || 'Analyze' },
    '/reports': { icon: '/view-reports-favicon.png', title: t('nav.reports') || 'Reports' },
    '/settings': { icon: '/settings-favicon.png', title: t('nav.settings') || 'Settings' },
    '/login': { icon: '/login-favicon.png', title: t('common.log_in') || 'Login' },
    '/signup': { icon: '/signup-favicon.png', title: t('common.sign_up') || 'Sign Up' },
    '/dashboard': { icon: '/dashboard-favicon.png', title: t('nav.dashboard') || 'Dashboard' },
    '/': { icon: '/dashboard-favicon.png', title: t('nav.home') || 'Home' },
  }), [t]);

  useEffect(() => {
    // Mevcut favicon elementini bul veya yoksa oluştur
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }

    const path = location.pathname.toLowerCase();

    // URL'deki ana dizini alıyoruz (örn: "/settings/profile" gelse bile "/settings" kısmını yakalar)
    const baseRoute = path === '/' ? '/' : '/' + path.split('/')[1];

    // Eşleşen rotayı objeden çek, yoksa varsayılan olarak Home/Dashboard ayarlarını kullan
    const currentConfig = routeConfig[baseRoute] || { icon: '/dashboard-favicon.png', title: 'Expense Tracker' };

    // Favicon'u güncelle
    link.href = currentConfig.icon;

    // Tarayıcı sekme başlığını (Title) dinamik ve çevirili olarak güncelle
    document.title = baseRoute === '/'
      ? 'Expense Tracker'
      : `${currentConfig.title} - Expense Tracker`;

  }, [location, routeConfig]);

  return null;
}

export default DynamicFavicon;