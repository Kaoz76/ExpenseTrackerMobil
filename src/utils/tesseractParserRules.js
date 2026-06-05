// src/utils/tesseractParserRules.js
//
// Tesseract.js (web) OCR çıktısına özel ayrıştırma kuralları.
// Bu kurallar YALNIZCA Tesseract yolunda kullanılır.
// ML Kit tarafı kendi kurallarını (mlKitParserRules.js) kullanır.

export const tesseractParserRules = {
  // Toplam fiyat anahtar kelimeleri
  keywordRegex: /(toplam|topla|total|tutar|amount|odenecek|grand|bakiye|genel|sum|summe|totale|balance|due|nakit|kredi|k\.karti|kart|t\s*o\s*p\s*l\s*a\s*m|t\s*u\s*t\s*a\s*r|t\s*o\s*t\s*a\s*l|t[o0.]?plam)/i,

  fuzzyKeywords: ['toplam', 'topla', 'total', 'tutar', 'amount', 'odenecek', 'grand', 'bakiye', 'genel', 'totale', 'balance', 'due', 'nakit', 'kredi'],

  // Atlanacak satırlar (KDV, banka bilgisi, fiş meta verisi vb.)
  excludeRegex: /(kdv|kdy|kdb|vat|tax|tva|mwst|iva|sales tax|state tax|para ustu|para üstü|change|vak[iı]f|vaz[iı]r|z[iı]raat|garant[iı]|[iıişş]\s*bank|yap[iı]\s*kred[iı]|akbank|halkbank|halk\s*bank|f[iı]nansbank|qnb|den[iı]zbank|teb|kuveyt|enpara|bankkart|bank\s*kart|mastercard|v[iı]sa|maestro|puan|po[iı]nt|kazanc|kazanç|kasa\s*no|f[iı][sş]\s*no|tar[iı]h|saat|teşekkürler|tesekkurler|mali\s*de[gğ]eri\s*yoktur|kas[iı]yer|cash[iı]er|term[iı]nal|sl[iı]p|belge\s*no|mers[iı]s|v\.?d\.?|verg[iı]\s*da[iı]res[iı]|tc\s*k[iı]ml[iı]k|s[iı]c[iı]l\s*no|store\s*no|receipt\s*no|thank\s*you|merci|danke|grazie|tl\/kg|tl\s*\/kg|tl\s*\/\s*kg|tl\/adet|tl\/gr|ettn|refno|ref\.?\s*no|z\s*no|onay\s*no|e-?ar[sş][iı]v|fatura|\bmatrah[ıi]?\b|\byuvarlama\b|\bvergi[sş]i?\b|\bdahil\b|\btutar[ıi]?\b|\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b)/i,

  // Tartı/çarpan hesabı satırları (ör: "0.880 KG x 129.95 TL/KG")
  // NOT: * çarpan olarak KULLANILMAZ — Türk fişlerinde * fiyat işaretidir (ör: *125,00)
  multiplierRegex: /(\d+(?:[.,]\d+)?)\s*(kg|gr|kc|l|ml|adet)\s*(?:[xX]|tl\/(?:kg|gr|kc)|tg)/i,

  // Fiyat algılama
  priceRegex: /\d{1,3}(?:[.,]\d{3})+(?![.,]?\d)|\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+[.,]\d{1,2}/g,

  // Ürün boyutu algılama (ör: "2 KG", "500 ML")
  itemSizeRegex: /\b(\d+(?:[.,]\d+)?)\s*(kg|gr|g|l|lt|ml|cl|mg|adet|ad|kc)\b/i,

  // Tesseract metinleri çok hatalı okuduğu için (satır birleşmeleri, anlamsız harfler),
  // ürün ayrıştırmayı tamamen kapatıp sadece Toplam Fiyat, Tarih ve Mağaza arıyoruz.
  extractItems: false
};
