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
 * Cleans and formats a store name.
 */
export const cleanStoreName = (name) => {
  if (!name) return "Unknown Store";
  let cleanName = name.replace(/\.(jpg|jpeg|png|pdf)$/i, '');
  return trTitleCase(brandAutoCorrect(cleanName)).trim();
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
      let cost = 1;
      if (i > 0) {
        const charS = s[j - 1].toLowerCase();
        const charT = t[i - 1].toLowerCase();
        if (charS === charT) {
          cost = 0;
        } else {
          const ocrMistakes = new Set([
            '0o', 'o0', '1l', 'l1', '1i', 'i1', '5s', 's5', '8b', 'b8', 'ce', 'ec', 'rn', 'nr', '2z', 'z2'
          ]);
          if (ocrMistakes.has(charS + charT)) {
            cost = 0.4;
          }
        }
      }
      arr[i][j] = i === 0 ? j : Math.min(
        arr[i - 1][j] + 1,
        arr[i][j - 1] + 1,
        arr[i - 1][j - 1] + cost
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
 * - Tek karakterli kelimeleri siler (stray "X", "A" gibi OCR artıkları dahil)
 * - Sadece sayılardan oluşan kelimeleri eler
 */
export const cleanItemName = (name) => {
  if (typeof name !== 'string' || !name.trim()) return name;

  let cleaned = name;

  // 1. Fiyat token'larını sil: *91,90  *125.50  %1  *08  vb.
  //    Önce tam fiyat ifadelerini (ondalıklı dahil) yakala, sonra yalnız kalan % * işaretlerini temizle.
  cleaned = cleaned.replace(/[%*]\s?\d+(?:[.,]\d+)?/g, '');

  // 1b. Multiplier / adet çarpanlarını sil: x1, X1, x 1, 1x, 1X, 1 x, x85,89 vb.
  cleaned = cleaned.replace(/\b[xX]\s?\d+(?:[.,]\d+)?\b/g, '');
  cleaned = cleaned.replace(/\b\d+\s?[xX]\b/g, '');

  // 1c. Kalan yalnız çarpanları sil (örn: "0,53 Kgx")
  cleaned = cleaned.replace(/^\s*\d+(?:[.,]\d+)?\s*(kg|gr|g|l|lt|ml|cl|mg|adet|ad|kc)x?\s*$/i, '');

  // 2. Baştaki stok/barkod numaralarını sil (5+ haneli sayı dizileri)
  cleaned = cleaned.replace(/^\d{5,}\s*/g, '');

  // 3. Sondaki yalnız sayı gruplarını sil (ağırlık/miktar kodları: "1 AD", "2 AD", "1.000")
  cleaned = cleaned.replace(/\s+\d+\s*(ad|adet)?\s*$/gi, '');

  // 4. Anlamsız özel karakterleri sil (harfler, sayılar, boşluk, nokta, virgül, tire, parantez hariç her şey)
  cleaned = cleaned.replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ\s.,()/-]/g, '');

  // 5. Tekrarlayan boşlukları tek boşluğa indir
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

  // 6. Sadece baştaki ve sondaki tekil anlamsız karakterleri sil (tamamen ortadaki kelimeleri yok etme!)
  // Çünkü "1200 B TUKLIMA" gibi isimlerde 1200 ve B'nin silinmesi veriyi bozar.
  const words = cleaned.split(' ');
  const filteredWords = words.filter(w => {
    // Keep everything if it's the only word
    if (words.length === 1) return true;
    
    // If it's a single character at the very beginning or end, and it's not a number, maybe drop it
    // But honestly, it's safer to keep most things since we already stripped garbage symbols.
    // Let's only drop isolated single non-alphanumeric characters if they survived
    if (w.length === 1 && !/[a-zA-Z0-9çğıöşüÇĞİÖŞÜ]/.test(w)) return false;
    
    // Don't drop purely numeric words like "1200" or single letters like "B" because they might be model numbers!
    return true;
  });

  cleaned = filteredWords.join(' ').trim();

  // 7. Strip trailing 1-2 char garbage words (OCR artifacts from adjacent text: "Ai", "Bi", "Da")
  cleaned = cleaned.replace(/\s+[a-zA-ZçğıöşüÇĞİÖŞÜ]{1,2}\s*$/, '').trim();

  // 8. Strip trailing number+period artifacts like "10006." (misread sizes like 1000G.)
  cleaned = cleaned.replace(/\s+\d{3,}[.,]?\s*$/, '').trim();

  // Eğer temizleme sonrası tamamen boş kaldıysa, bu kelimenin tamamen çöp/çarpan olduğunu anlarız.
  // Sadece eğer orijinal isim harf içeriyorsa geri döndür (sayı/çöp değilse)
  if (cleaned.length === 0) {
    if (/[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(name) && !/^\s*\d+(?:[.,]\d+)?\s*(kg|gr|g|l|lt|ml|cl|mg|adet|ad|kc)x?\s*$/i.test(name)) {
      return name.trim();
    }
    return "";
  }
  return cleaned;
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
export const findBestProductMatch = (ocrName, existingNames, maxDistanceRatio = 0.25) => {
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

