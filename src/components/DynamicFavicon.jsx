import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// 1. Geliştirme: Rotaları, Faviconları ve Sayfa Başlıklarını bir Obje'de topluyoruz.
// (Bunu component dışına yazıyoruz ki her sayfa değişiminde yeniden bellekte oluşmasın)
const routeConfig = {
  '/receipts': { icon: '/scans-favicon.png', title: 'Scans' },
  '/texts': { icon: '/texts-favicon.png', title: 'Add Entry' },
  '/products': { icon: '/products-favicon.png', title: 'Products' },
  '/stores': { icon: '/stores-favicon.png', title: 'Stores' },
  '/analyze': { icon: '/analyze-expenses-favicon.png', title: 'Analyze' },
  '/reports': { icon: '/view-reports-favicon.png', title: 'Reports' },
  '/settings': { icon: '/settings-favicon.png', title: 'Settings' },
  '/login': { icon: '/login-favicon.png', title: 'Login' },
  '/signup': { icon: '/signup-favicon.png', title: 'Sign Up' },
  '/dashboard': { icon: '/dashboard-favicon.png', title: 'Dashboard' },
  '/': { icon: '/dashboard-favicon.png', title: 'Dashboard' },
};

function DynamicFavicon() {
  const location = useLocation();

  useEffect(() => {
    // Mevcut favicon elementini bul veya yoksa oluştur
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link); // getElementsByTagName yerine daha modern olan document.head kullandık
    }

    const path = location.pathname.toLowerCase();

    // URL'deki ana dizini alıyoruz (örn: "/settings/profile" gelse bile "/settings" kısmını yakalar)
    const baseRoute = '/' + path.split('/')[1];

    // Eşleşen rotayı objeden çek, yoksa varsayılan olarak Dashboard ayarlarını kullan
    const currentConfig = routeConfig[baseRoute] || routeConfig['/'];

    // Favicon'u güncelle
    link.href = currentConfig.icon;

    // 2. Geliştirme: Tarayıcı sekme başlığını (Title) dinamik olarak güncelle
    document.title = `${currentConfig.title} - Expense Tracker`;

  }, [location]);

  return null;
}

export default DynamicFavicon;