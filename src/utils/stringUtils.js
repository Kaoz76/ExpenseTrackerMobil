/**
 * Locale-aware string utilities
 * Automatically detects browser language for proper character conversion (especially Turkish i/I)
 */
import { brandDictionary, commonMisreads } from '../data/brandDictionary';

const getLocale = () => {
  // Use browser language if available, default to Turkish if not specified
  // but allow it to fall back to English or others naturally.
  return navigator.language || 'tr-TR';
};

const locale = getLocale();

/**
 * Converts a string to lowercase using detected locale rules.
 */
export const trToLower = (str) => {
  if (typeof str !== 'string') return "";
  return str.toLocaleLowerCase(locale);
};

/**
 * Converts a string to uppercase using detected locale rules.
 */
export const trToUpper = (str) => {
  if (typeof str !== 'string') return "";
  return str.toLocaleUpperCase(locale);
};

/**
 * Capitalizes each word in a string using detected locale rules.
 */
export const trTitleCase = (str) => {
  if (typeof str !== 'string') return "";
  return str
    .toLocaleLowerCase(locale)
    .split(' ')
    .map(word => word.charAt(0).toLocaleUpperCase(locale) + word.slice(1))
    .join(' ');
};

/**
 * Checks if a string includes another string, case-insensitively using locale rules.
 */
export const trIncludes = (source, target) => {
  if (typeof source !== 'string' || typeof target !== 'string') return false;
  return trToLower(source).includes(trToLower(target));
};

// ─── OCR Ürün İsmi Temizleme ───────────────────────────────────────────────

/**
 * Levenshtein Distance — iki kelime arasındaki düzenleme mesafesini hesaplar.
 */
const levenshtein = (s, t) => {
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const arr = [];
  for (let i = 0; i <= t.length; i++) {
    arr[i] = [i];
    for (let j = 1; j <= s.length; j++) {
      arr[i][j] = i === 0 ? j : Math.min(
        arr[i - 1][j] + 1,
        arr[i][j - 1] + 1,
        arr[i - 1][j - 1] + (s[j - 1] === t[i - 1] ? 0 : 1)
      );
    }
  }
  return arr[t.length][s.length];
};

/**
 * OCR'dan gelen ürün isimlerini temizler:
 * - Fiş reyon/KDV kodlarını kaldırır (%8, *08, %18, vb.)
 * - Stok/barkod numaralarını kaldırır (baştaki uzun sayı dizileri)
 * - Anlamsız özel karakterleri (@, |, ], [, {, }, ~, ^, <, >, =) siler
 * - Tekrar eden boşlukları temizler
 * - Çok kısa (1 harfli) kelimeleri ve sadece sayılardan oluşan kelimeleri eler
 */
export const cleanItemName = (name) => {
  if (typeof name !== 'string' || !name.trim()) return name;

  let cleaned = name;

  // 1. KDV / vergi oran kodlarını sil: %1, %8, *08, %18, *18, %20, *01 vb.
  cleaned = cleaned.replace(/[%*]\s?\d{1,2}/g, '');

  // 1b. Multiplier / adet çarpanlarını sil: x1, X1, x 1, 1x, 1X, 1 x, vb.
  cleaned = cleaned.replace(/\b[xX]\s?\d+\b/g, '');
  cleaned = cleaned.replace(/\b\d+\s?[xX]\b/g, '');

  // 2. Baştaki stok/barkod numaralarını sil (5+ haneli sayı dizileri)
  cleaned = cleaned.replace(/^\d{5,}\s*/g, '');

  // 3. Sondaki yalnız sayı gruplarını sil (ağırlık/miktar kodları: "1 AD", "2 AD", "1.000")
  cleaned = cleaned.replace(/\s+\d+\s*(ad|adet)?\s*$/gi, '');

  // 4. Anlamsız özel karakterleri sil (harfler, sayılar, boşluk, nokta, virgül, tire, parantez hariç her şey)
  cleaned = cleaned.replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ\s.,()/-]/g, '');

  // 5. Tekrarlayan boşlukları tek boşluğa indir
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  // 6. Sadece sayılardan oluşan kelimeleri sil (ama en az bir harf içerenler kalsın)
  const words = cleaned.split(' ').filter(w => {
    if (w.length <= 1 && !/[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(w)) return false; // tek karakterli sayılar
    if (/^\d+[.,]?\d*$/.test(w)) return false; // tamamen sayı olan kelimeler
    return true;
  });

  cleaned = words.join(' ').trim();

  // Eğer temizleme sonrası boş kaldıysa orijinali döndür
  return cleaned.length > 0 ? cleaned : name.trim();
};

/**
 * OCR'dan okunan ürün ismini, kullanıcının mevcut ürün listesiyle karşılaştırır.
 * Eğer yeterince benzer (Levenshtein mesafesi eşik altında) bir ürün bulursa,
 * o ürünün doğru ismini döndürür. Bulamazsa orijinal ismi döndürür.
 *
 * @param {string} ocrName - OCR'dan okunan (temizlenmiş) ürün ismi
 * @param {string[]} existingNames - Veri tabanındaki mevcut ürün isimleri
 * @param {number} maxDistanceRatio - Kabul edilebilir max hata oranı (0-1), varsayılan 0.35
 * @returns {string} Eşleşen ürün ismi veya orijinal isim
 */
export const findBestProductMatch = (ocrName, existingNames, maxDistanceRatio = 0.35) => {
  if (!ocrName || !existingNames || existingNames.length === 0) return ocrName;

  const normalizedOcr = trToLower(ocrName).trim();
  if (normalizedOcr.length < 3) return ocrName; // Çok kısa isimler eşleştirmeye değmez

  let bestMatch = null;
  let bestDistance = Infinity;

  for (const existing of existingNames) {
    const normalizedExisting = trToLower(existing).trim();
    if (normalizedExisting.length < 3) continue;

    const dist = levenshtein(normalizedOcr, normalizedExisting);
    const maxLen = Math.max(normalizedOcr.length, normalizedExisting.length);
    const ratio = dist / maxLen;

    // Eşik: kelimenin uzunluğunun %35'inden az hata varsa eşleştir
    if (ratio < maxDistanceRatio && dist < bestDistance) {
      bestDistance = dist;
      bestMatch = existing;
    }
  }

  return bestMatch || ocrName;
};

// ─── Otomatik Marka/Mağaza Düzeltme Sözlüğü ───────────────────────────────

/**
 * Yaygın OCR hatalarını (B yerine E, i yerine ı vb.) markalar özelinde düzeltir.
 */
export const brandAutoCorrect = (name) => {
  if (!name || typeof name !== 'string') return name;

  const corrections = brandDictionary;

  const lowerName = name.toLowerCase();
  
  // Tam eşleşme kontrolü
  if (corrections[lowerName]) return corrections[lowerName];

  // Kelime bazlı kontrol (Regex ile toplu değişim)
  let correctedName = name;
  commonMisreads.forEach(({ wrong, right }) => {
    correctedName = correctedName.replace(wrong, right);
  });

  return correctedName;
};

