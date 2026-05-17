/**
 * Kategori eşleştirme sözlüğü (Category Map)
 * Bu dosya, uygulamadaki harcama kategorilerine otomatik olarak ikon (emoji)
 * ve renk atamak için kullanılır.
 */

const categoryDictionary = {
  // Gıda ve Market
  'market': { icon: '🛒', color: '#10b981' }, // Zümrüt Yeşili
  'grocery': { icon: '🛒', color: '#10b981' },
  'gıda': { icon: '🥖', color: '#059669' },
  'food': { icon: '🍔', color: '#ef4444' },
  'yemek': { icon: '🍔', color: '#ef4444' },
  'restaurant': { icon: '🍽️', color: '#f43f5e' },
  'restoran': { icon: '🍽️', color: '#f43f5e' },
  'cafe': { icon: '☕', color: '#d97706' },
  'kafe': { icon: '☕', color: '#d97706' },

  // Giyim ve Moda
  'giyim': { icon: '👕', color: '#8b5cf6' }, // Mor
  'clothing': { icon: '👕', color: '#8b5cf6' },
  'apparel': { icon: '👗', color: '#a855f7' },
  'moda': { icon: '👗', color: '#a855f7' },
  'ayakkabı': { icon: '👞', color: '#6366f1' },
  'shoes': { icon: '👟', color: '#6366f1' },

  // Teknoloji ve Elektronik
  'elektronik': { icon: '💻', color: '#3b82f6' }, // Mavi
  'electronics': { icon: '💻', color: '#3b82f6' },
  'teknoloji': { icon: '📱', color: '#2563eb' },
  'tech': { icon: '📱', color: '#2563eb' },
  'software': { icon: '💾', color: '#0ea5e9' },
  'yazılım': { icon: '💾', color: '#0ea5e9' },

  // Ulaşım ve Akaryakıt
  'akaryakıt': { icon: '⛽', color: '#f59e0b' }, // Turuncu
  'yakıt': { icon: '⛽', color: '#f59e0b' },
  'fuel': { icon: '⛽', color: '#f59e0b' },
  'ulaşım': { icon: '🚌', color: '#eab308' },
  'transport': { icon: '🚗', color: '#eab308' },
  'taksi': { icon: '🚕', color: '#facc15' },
  'taxi': { icon: '🚕', color: '#facc15' },

  // Ev ve Yaşam
  'ev': { icon: '🏠', color: '#14b8a6' }, // Teal
  'home': { icon: '🏠', color: '#14b8a6' },
  'mobilya': { icon: '🛋️', color: '#0d9488' },
  'furniture': { icon: '🛋️', color: '#0d9488' },
  'kira': { icon: '🔑', color: '#0f766e' },
  'rent': { icon: '🔑', color: '#0f766e' },
  'fatura': { icon: '🧾', color: '#64748b' },
  'bills': { icon: '🧾', color: '#64748b' },
  'utilities': { icon: '⚡', color: '#475569' },

  // Kişisel Bakım ve Sağlık
  'sağlık': { icon: '🏥', color: '#ec4899' }, // Pembe
  'health': { icon: '🏥', color: '#ec4899' },
  'eczane': { icon: '💊', color: '#f472b6' },
  'pharmacy': { icon: '💊', color: '#f472b6' },
  'kozmetik': { icon: '💄', color: '#db2777' },
  'cosmetics': { icon: '💄', color: '#db2777' },
  'bakım': { icon: '🧴', color: '#be185d' },
  'care': { icon: '🧴', color: '#be185d' },

  // Eğlence ve Abonelikler
  'eğlence': { icon: '🎬', color: '#84cc16' }, // Açık Yeşil
  'entertainment': { icon: '🎬', color: '#84cc16' },
  'abonelik': { icon: '🔄', color: '#10b981' },
  'subscription': { icon: '🔄', color: '#10b981' },
  'oyun': { icon: '🎮', color: '#22c55e' },
  'gaming': { icon: '🎮', color: '#22c55e' },
  'hobi': { icon: '🎨', color: '#14b8a6' },
  'hobby': { icon: '🎨', color: '#14b8a6' },

  // Eğitim ve Kırtasiye
  'eğitim': { icon: '📚', color: '#0284c7' }, // Gök Mavisi
  'education': { icon: '📚', color: '#0284c7' },
  'kitap': { icon: '📖', color: '#0369a1' },
  'book': { icon: '📖', color: '#0369a1' },
  'kırtasiye': { icon: '✏️', color: '#0284c7' },
  'stationery': { icon: '✏️', color: '#0284c7' },

  // Diğer ve Bilinmeyen
  'diğer': { icon: '📦', color: '#94a3b8' },
  'other': { icon: '📦', color: '#94a3b8' },
  'bilinmeyen': { icon: '❓', color: '#64748b' },
  'unknown': { icon: '❓', color: '#64748b' }
};

// Renk paleti havuzu (Kategorisi bilinmeyen ama dinamik renklendirilmesi gerekenler için)
const colorPool = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', 
  '#8b5cf6', '#3b82f6', '#ec4899', '#14b8a6', 
  '#f97316', '#84cc16', '#06b6d4', '#d946ef'
];

/**
 * Verilen kategori ismine göre ikon ve renk döner.
 * @param {string} categoryName - Kategori ismi (örn: 'Market', 'Giyim')
 * @returns {Object} { icon: '🛒', color: '#10b981' }
 */
export const getCategoryInfo = (categoryName) => {
  if (!categoryName) {
    return { icon: '🏷️', color: '#94a3b8' };
  }

  const normalizedCategory = categoryName.toString().trim().toLowerCase();

  // Birebir eşleşme kontrolü
  if (categoryDictionary[normalizedCategory]) {
    return categoryDictionary[normalizedCategory];
  }

  // Kısmi eşleşme kontrolü (örn: "Market Harcaması" kelimesi içinde "market" geçiyor mu?)
  for (const [key, value] of Object.entries(categoryDictionary)) {
    if (normalizedCategory.includes(key)) {
      return value;
    }
  }

  // Eşleşme bulunamazsa, kategori ismine göre tutarlı (hash) bir rastgele renk seç
  let hash = 0;
  for (let i = 0; i < normalizedCategory.length; i++) {
    hash = normalizedCategory.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % colorPool.length;

  return { 
    icon: '🏷️', // Varsayılan İkon
    color: colorPool[colorIndex] // Hash tabanlı rastgele ama tutarlı renk
  };
};
