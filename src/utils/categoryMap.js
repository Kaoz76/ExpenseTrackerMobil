/**
 * Kategori eşleştirme sözlüğü (Category Map)
 * Bu dosya, uygulamadaki harcama kategorilerine otomatik olarak ikon (emoji)
 * ve renk atamak için kullanılır.
 */

const categoryDictionary = {
  // Gıda ve Market
  'market': { icon: '🛒', color: '#10b981' },
  'grocery': { icon: '🛒', color: '#10b981' },
  'gıda': { icon: '🥗', color: '#059669' },
  'food': { icon: '🥗', color: '#059669' },
  'yemek': { icon: '🍽️', color: '#ef4444' },
  'dining': { icon: '🍽️', color: '#ef4444' },
  'restaurant': { icon: '🍴', color: '#f43f5e' },
  'restoran': { icon: '🍴', color: '#f43f5e' },
  'cafe': { icon: '☕', color: '#d97706' },
  'kafe': { icon: '☕', color: '#d97706' },

  // Giyim ve Moda
  'giyim': { icon: '👕', color: '#8b5cf6' },
  'clothing': { icon: '👕', color: '#8b5cf6' },
  'apparel': { icon: '👕', color: '#8b5cf6' },
  'moda': { icon: '👗', color: '#a855f7' },
  'fashion': { icon: '👗', color: '#a855f7' },
  'ayakkabı': { icon: '👟', color: '#6366f1' },
  'shoes': { icon: '👟', color: '#6366f1' },

  // Teknoloji ve Elektronik
  'elektronik': { icon: '💻', color: '#3b82f6' },
  'electronics': { icon: '💻', color: '#3b82f6' },
  'teknoloji': { icon: '📱', color: '#2563eb' },
  'technology': { icon: '📱', color: '#2563eb' },
  'tech': { icon: '📱', color: '#2563eb' },
  'software': { icon: '💾', color: '#0ea5e9' },
  'yazılım': { icon: '💾', color: '#0ea5e9' },

  // Ulaşım ve Akaryakıt
  'akaryakıt': { icon: '⛽', color: '#f59e0b' },
  'yakıt': { icon: '⛽', color: '#f59e0b' },
  'fuel': { icon: '⛽', color: '#f59e0b' },
  'ulaşım': { icon: '🚌', color: '#eab308' },
  'transport': { icon: '🚌', color: '#eab308' },
  'taksi': { icon: '🚕', color: '#facc15' },
  'taxi': { icon: '🚕', color: '#facc15' },

  // Ev ve Yaşam
  'ev': { icon: '🏠', color: '#14b8a6' },
  'home': { icon: '🏠', color: '#14b8a6' },
  'mobilya': { icon: '🛋️', color: '#0d9488' },
  'furniture': { icon: '🛋️', color: '#0d9488' },
  'kira': { icon: '🔑', color: '#0f766e' },
  'rent': { icon: '🔑', color: '#0f766e' },
  'fatura': { icon: '🧾', color: '#64748b' },
  'bills': { icon: '🧾', color: '#64748b' },
  'utilities': { icon: '⚡', color: '#475569' },

  // Kişisel Bakım ve Sağlık
  'sağlık': { icon: '🏥', color: '#ec4899' },
  'health': { icon: '🏥', color: '#ec4899' },
  'eczane': { icon: '💊', color: '#f472b6' },
  'pharmacy': { icon: '💊', color: '#f472b6' },
  'kozmetik': { icon: '💄', color: '#db2777' },
  'cosmetics': { icon: '💄', color: '#db2777' },
  'bakım': { icon: '🧴', color: '#be185d' },
  'care': { icon: '🧴', color: '#be185d' },

  // Eğlence ve Abonelikler
  'eğlence': { icon: '🎬', color: '#84cc16' },
  'entertainment': { icon: '🎬', color: '#84cc16' },
  'abonelik': { icon: '🔄', color: '#10b981' },
  'subscription': { icon: '🔄', color: '#10b981' },
  'oyun': { icon: '🎮', color: '#22c55e' },
  'gaming': { icon: '🎮', color: '#22c55e' },
  'hobi': { icon: '🎨', color: '#14b8a6' },
  'hobby': { icon: '🎨', color: '#14b8a6' },

  // Eğitim ve Kırtasiye
  'eğitim': { icon: '📚', color: '#0284c7' },
  'education': { icon: '📚', color: '#0284c7' },
  'kitap': { icon: '📖', color: '#0369a1' },
  'book': { icon: '📖', color: '#0369a1' },
  'books': { icon: '📖', color: '#0369a1' },
  'kırtasiye': { icon: '✏️', color: '#0284c7' },
  'stationery': { icon: '✏️', color: '#0284c7' },

  // Evcil Hayvan
  'evcil hayvan': { icon: '🐾', color: '#f97316' },
  'pet': { icon: '🐾', color: '#f97316' },
  'petshop': { icon: '🐾', color: '#f97316' },

  // Bebek
  'bebek': { icon: '🍼', color: '#f9a8d4' },
  'baby': { icon: '🍼', color: '#f9a8d4' },

  // Spor & Fitness
  'spor': { icon: '🏋️', color: '#06b6d4' },
  'sports': { icon: '🏋️', color: '#06b6d4' },
  'fitness': { icon: '🏋️', color: '#06b6d4' },

  // Alkol ve Tütün
  'alkol & tütün': { icon: '🍺', color: '#b45309' },
  'alcohol & tobacco': { icon: '🍺', color: '#b45309' },
  'alkol': { icon: '🍺', color: '#b45309' },
  'alcohol': { icon: '🍺', color: '#b45309' },
  'tütün': { icon: '🚬', color: '#78716c' },
  'tobacco': { icon: '🚬', color: '#78716c' },
  'sigara': { icon: '🚬', color: '#78716c' },
  'cigarette': { icon: '🚬', color: '#78716c' },

  // Vergiler
  'vergiler': { icon: '💸', color: '#f43f5e' },
  'taxes': { icon: '💸', color: '#f43f5e' },
  'vergi': { icon: '💸', color: '#f43f5e' },
  'tax': { icon: '💸', color: '#f43f5e' },

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

// Türkçe kategori isimleri
export const suggestedCategoriesTR = [
  'Market', 'Gıda', 'Yemek', 'Kafe', 'Restoran', 
  'Giyim', 'Ayakkabı', 'Moda',
  'Elektronik', 'Teknoloji', 'Yazılım',
  'Akaryakıt', 'Ulaşım', 'Taksi',
  'Ev', 'Mobilya', 'Kira', 'Fatura',
  'Sağlık', 'Eczane', 'Kozmetik',
  'Eğlence', 'Abonelik', 'Oyun', 'Hobi',
  'Eğitim', 'Kitap', 'Kırtasiye',
  'Alkol & Tütün', 'Evcil Hayvan', 'Bebek', 'Spor', 'Vergiler', 'Diğer'
].sort();

// İngilizce kategori isimleri
export const suggestedCategoriesEN = [
  'Grocery', 'Food', 'Dining', 'Cafe', 'Restaurant', 
  'Clothing', 'Shoes', 'Fashion',
  'Electronics', 'Technology', 'Software',
  'Fuel', 'Transport', 'Taxi',
  'Home', 'Furniture', 'Rent', 'Bills',
  'Health', 'Pharmacy', 'Cosmetics',
  'Entertainment', 'Subscription', 'Gaming', 'Hobby',
  'Education', 'Books', 'Stationery',
  'Alcohol & Tobacco', 'Pet', 'Baby', 'Sports', 'Taxes', 'Other'
].sort();

// TR ↔ EN Kategori Çeviri Haritası
export const categoryTranslationMap = {
  // TR -> EN
  'Market': 'Grocery',
  'Gıda': 'Food',
  'Yemek': 'Dining',
  'Kafe': 'Cafe',
  'Restoran': 'Restaurant',
  'Giyim': 'Clothing',
  'Ayakkabı': 'Shoes',
  'Moda': 'Fashion',
  'Elektronik': 'Electronics',
  'Teknoloji': 'Technology',
  'Yazılım': 'Software',
  'Akaryakıt': 'Fuel',
  'Ulaşım': 'Transport',
  'Taksi': 'Taxi',
  'Ev': 'Home',
  'Mobilya': 'Furniture',
  'Kira': 'Rent',
  'Fatura': 'Bills',
  'Sağlık': 'Health',
  'Eczane': 'Pharmacy',
  'Kozmetik': 'Cosmetics',
  'Eğlence': 'Entertainment',
  'Abonelik': 'Subscription',
  'Oyun': 'Gaming',
  'Hobi': 'Hobby',
  'Eğitim': 'Education',
  'Kitap': 'Books',
  'Kırtasiye': 'Stationery',
  'Alkol & Tütün': 'Alcohol & Tobacco',
  'Evcil Hayvan': 'Pet',
  'Bebek': 'Baby',
  'Spor': 'Sports',
  'Vergiler': 'Taxes',
  'Diğer': 'Other',
  // EN -> TR
  'Grocery': 'Market',
  'Food': 'Gıda',
  'Dining': 'Yemek',
  'Cafe': 'Kafe',
  'Restaurant': 'Restoran',
  'Clothing': 'Giyim',
  'Shoes': 'Ayakkabı',
  'Fashion': 'Moda',
  'Electronics': 'Elektronik',
  'Technology': 'Teknoloji',
  'Software': 'Yazılım',
  'Fuel': 'Akaryakıt',
  'Transport': 'Ulaşım',
  'Taxi': 'Taksi',
  'Home': 'Ev',
  'Furniture': 'Mobilya',
  'Rent': 'Kira',
  'Bills': 'Fatura',
  'Health': 'Sağlık',
  'Pharmacy': 'Eczane',
  'Cosmetics': 'Kozmetik',
  'Entertainment': 'Eğlence',
  'Subscription': 'Abonelik',
  'Gaming': 'Oyun',
  'Hobby': 'Hobi',
  'Education': 'Eğitim',
  'Books': 'Kitap',
  'Stationery': 'Kırtasiye',
  'Alcohol & Tobacco': 'Alkol & Tütün',
  'Pet': 'Evcil Hayvan',
  'Baby': 'Bebek',
  'Sports': 'Spor',
  'Taxes': 'Vergiler',
  'Other': 'Diğer',
};

/**
 * Normalizes and localizes any category name based on target language.
 * Always resolves Alcohol & Tobacco and Alkol & Tütün to the same category.
 */
export const localizeCategory = (categoryName, lang = 'en') => {
  if (!categoryName) return lang === 'tr' ? 'Diğer' : 'Other';

  const trimmed = categoryName.trim();

  // Special Check for Alcohol & Tobacco variants
  const isAlcoholTobacco = /^(alcohol\s*&\s*tobacco|alkol\s*&\s*tütün|alkol|tütün|alcohol|tobacco)$/i.test(trimmed);
  if (isAlcoholTobacco) {
    return lang === 'tr' ? 'Alkol & Tütün' : 'Alcohol & Tobacco';
  }

  // Check if it matches exactly
  if (lang === 'tr') {
    if (suggestedCategoriesTR.includes(trimmed)) {
      return trimmed;
    }
    if (categoryTranslationMap[trimmed]) {
      return categoryTranslationMap[trimmed];
    }
  } else {
    if (suggestedCategoriesEN.includes(trimmed)) {
      return trimmed;
    }
    if (categoryTranslationMap[trimmed]) {
      return categoryTranslationMap[trimmed];
    }
  }

  // Case-insensitive lookup
  const lower = trimmed.toLowerCase();
  for (const [tr, en] of Object.entries(categoryTranslationMap)) {
    if (tr.toLowerCase() === lower) {
      return lang === 'tr' ? tr : en;
    }
    if (en.toLowerCase() === lower) {
      return lang === 'tr' ? tr : en;
    }
  }

  // Fallback to title case
  return trimmed;
};
