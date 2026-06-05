// src/utils/ocrUtils.js
import { trToLower, trTitleCase, cleanItemName, brandAutoCorrect } from './stringUtils';
import { isFuzzyMatch } from './receiptUtils';

/**
 * Extracts structured data (total price, items, currency) from raw OCR text.
 * @param {string} text - Raw OCR text
 * @param {string} language - Current app language code (e.g. 'tr', 'en')
 * @param {string} defaultCurrencyCode - Fallback currency code (e.g. 'USD')
 * @param {Object} [rules] - OCR engine-specific parser rules (from mlKitParserRules or tesseractParserRules)
 * @returns {Object} { total, items, currency }
 */
export const extractDataFromText = (text, language, defaultCurrencyCode, rules) => {
  if (!text) return { total: 0, items: [] };

  // Pre-clean common Tesseract misreads:
  // 1. Correct space-separated prices at the end of lines (e.g. "*534   47" -> "*534,47")
  const spacePriceRegex = /\b(\d+)\s+(\d{2})(\s*[-*%₺$€£]?[a-zA-Z]*)$/gm;
  let preCleanedText = text.replace(spacePriceRegex, '$1,$2$3');

  // 2. Correct British Pound sign misreads on Turkish receipts (e.g. "£T" -> "TL", "£" -> "TL")
  if (language === 'tr') {
    preCleanedText = preCleanedText.replace(/£T/gi, 'TL').replace(/£/g, 'TL');
  } else {
    preCleanedText = preCleanedText.replace(/£T/gi, 'TL');
  }

  // Remove spaces between digits and dots/commas (e.g. "135, 00" -> "135,00")
  // Also remove spaces after a minus sign followed by a digit (e.g. "- 47,25" -> "-47,25")
  const cleanedText = preCleanedText
    .replace(/(\d+)\s*([.,])\s*(\d+)/g, '$1$2$3')
    .replace(/-\s*(\d+)/g, '-$1');

  let usTaxScore = 0;
  let ukTaxScore = 0;
  // eslint-disable-next-line no-unused-vars
  let extractedTaxAmount = 0;

  const normalizedText = trToLower(cleanedText.replace(/\r/g, '\n'));
  const lines = normalizedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  // Currency detection from OCR text
  let detectedCurrency = null;
  let tryCount = (normalizedText.match(/\b(tl|try|₺|türk\s*lirası|turk\s*lirasi)\b/g) || []).length;
  let usdCount = (normalizedText.match(/\b(usd|dollar|\$)\b/g) || []).length;
  let eurCount = (normalizedText.match(/\b(eur|euro|€)\b/g) || []).length;
  let gbpCount = (normalizedText.match(/\b(gbp|pound|£)\b/g) || []).length;

  tryCount += (normalizedText.match(/[₺]/g) || []).length;
  tryCount += (normalizedText.match(/\b\d+[.,]\d{2}tl\b/gi) || []).length;
  usdCount += (normalizedText.match(/[$]/g) || []).length;
  eurCount += (normalizedText.match(/[€]/g) || []).length;
  gbpCount += (normalizedText.match(/[£]/g) || []).length;

  if (tryCount > 0 || usdCount > 0 || eurCount > 0 || gbpCount > 0) {
    const maxCount = Math.max(tryCount, usdCount, eurCount, gbpCount);
    if (maxCount === tryCount) detectedCurrency = 'TRY';
    else if (maxCount === usdCount) detectedCurrency = 'USD';
    else if (maxCount === eurCount) detectedCurrency = 'EUR';
    else if (maxCount === gbpCount) detectedCurrency = 'GBP';
  }

  const finalCurrency = detectedCurrency || defaultCurrencyCode || 'USD';

  for (let line of lines) {
    if (/[Vv][Aa][Tt]|gbp|£|gross|net|tax\s*invoice/i.test(line)) ukTaxScore++;
    if (/\b(sales\s*tax|state\s*tax|usd|\$)\b/i.test(line)) usTaxScore++;
  }

  let isUSStyleTax = false;
  if (finalCurrency === 'USD') {
    isUSStyleTax = true;
  } else if (finalCurrency === 'GBP' || finalCurrency === 'EUR' || finalCurrency === 'TRY') {
    isUSStyleTax = false;
  } else {
    isUSStyleTax = (language !== 'tr') && (ukTaxScore <= usTaxScore);
  }

  // OCR engine'e özel kurallar (dışarıdan verilmezse varsayılan değerler kullanılır)
  const keywordRegex = rules?.keywordRegex || /(toplam|topla|total|tutar|amount|odenecek|grand|bakiye|genel|sum|summe|totale|balance|due|nakit|kredi|k\.karti|kart)/i;
  const fuzzyKeywords = rules?.fuzzyKeywords || ['toplam', 'topla', 'total', 'tutar', 'amount', 'odenecek', 'grand', 'bakiye', 'genel', 'totale', 'balance', 'due', 'nakit', 'kredi'];
  // eslint-disable-next-line no-useless-escape
  const excludeRegex = rules?.excludeRegex || /(kdv|vat|tax|tva|mwst|iva|sales tax|state tax|para ustu|para üstü|change|vak[iı]f|vaz[iı]r|z[iı]raat|garant[iı]|[iıişş]\s*bank|yap[iı]\s*kred[iı]|akbank|halkbank|halk\s*bank|f[iı]nansbank|qnb|den[iı]zbank|teb|kuveyt|enpara|bankkart|bank\s*kart|mastercard|v[iı]sa|maestro|puan|po[iı]nt|kazanc|kazanç|kasa\s*no|f[iı][şs]\s*no|tar[iı]h|saat|teşekkürler|tesekkurler|mali\s*de[gğ]eri\s*yoktur|kas[iı]yer|cash[iı]er|term[iı]nal|sl[iı]p|belge\s*no|mers[iı]s|v\.?d\.?|verg[iı]\s*da[iı]res[iı]|tc\s*k[iı]ml[iı]k|s[iı]c[iı]l\s*no|store\s*no|receipt\s*no|thank\s*you|merci|danke|grazie|tl\/kg|tl\s*\/kg|tl\s*\/\s*kg|tl\/adet|tl\/gr|ettn|refno|ref\.?\s*no|z\s*no|onay\s*no|e-?ar[sş][iı]v|fatura|\b\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}\b)/i;
  const multiplierRegex = rules?.multiplierRegex || /(\d+(?:[.,]\d+)?)\s*(kg|gr|kc|l|ml|adet)\s*(?:[xX]|tl\/(?:kg|gr|kc)|tg)/i;
  const priceRegex = rules?.priceRegex || /\d{1,3}(?:[.,]\d{3})+(?![.,]?\d)|\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+[.,]\d{1,2}/g;
  const itemSizeRegex = rules?.itemSizeRegex || /\b(\d+(?:[.,]\d+)?)\s*(kg|gr|g|l|lt|ml|cl|mg|adet|ad|kc)\b/i;

  const normalizeSize = (rawSize) => {
    if (!rawSize) return "";
    const match = rawSize.match(/^(\d+(?:[.,]\d+)?)\s*(kg|gr|g|l|lt|ml|cl|mg|adet|ad|kc)$/i);
    if (!match) return rawSize.trim().toUpperCase().replace('KC', 'KG');

    let val = match[1].replace(',', '.');
    let unit = match[2].toLowerCase();

    if (unit === 'gr') unit = 'g';
    if (unit === 'lt') unit = 'l';
    if (unit === 'kc') unit = 'kg';
    if (unit === 'ad') unit = 'adet';
    if (unit === 'l') {
      return `${val}L`;
    }
    return `${val}${unit}`;
  };

  let possibleTotals = [];
  let extractedItems = [];
  let previousOrphanedText = "";
  let previousOrphanedSize = "";
  let pendingPrice = null;
  let globalCachedSize = "";

  for (let line of lines) {
    const multiMatch = line.match(multiplierRegex);
    if (multiMatch) {
      let val = multiMatch[1].replace(',', '.');
      let unit = multiMatch[2].toUpperCase().replace('KC', 'KG');
      globalCachedSize = `${val} ${unit}`;
      break;
    }
  }

  const cleanAndParseNumber = (valStr) => {
    let cleanStr = valStr.replace(/[^0-9.,-]/g, '');

    // Check if both exist to find the actual decimal
    if (cleanStr.includes(',') && cleanStr.includes('.')) {
      const lastComma = cleanStr.lastIndexOf(',');
      const lastDot = cleanStr.lastIndexOf('.');

      if (lastComma > lastDot) {
        // Comma is the decimal separator (European/Turkish: 1.000,50)
        cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
      } else {
        // Dot is the decimal separator (US/International: 1,000.50)
        cleanStr = cleanStr.replace(/,/g, '');
      }
    } else if (cleanStr.includes(',')) {
      // Only comma exists. Check if it's a thousands separator (e.g. 17,999 or 1,234,567)
      if (/^\d{1,3}(,\d{3})+$/.test(cleanStr)) {
        // Thousands separator only — remove all commas (17,999 → 17999)
        cleanStr = cleanStr.replace(/,/g, '');
      } else {
        // Decimal separator (17,99 → 17.99)
        cleanStr = cleanStr.replace(',', '.');
      }
    } else if (cleanStr.includes('.')) {
      // Only dot exists. Check if it's a thousands separator (e.g. 17.999 or 1.234.567)
      if (/^\d{1,3}(\.\d{3})+$/.test(cleanStr)) {
        // Thousands separator only — remove all dots (17.999 → 17999)
        cleanStr = cleanStr.replace(/\./g, '');
      }
      // else: decimal dot, leave as is for parseFloat
    }

    const num = parseFloat(cleanStr);
    return !isNaN(num) ? num : null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (multiplierRegex.test(line)) continue;

    const hasKeyword = keywordRegex.test(line) || isFuzzyMatch(line, fuzzyKeywords);

    if (hasKeyword) {
      let matches = line.match(priceRegex);
      if (matches) {
        matches.forEach(m => {
          const parsed = cleanAndParseNumber(m);
          if (parsed) possibleTotals.push(parsed);
        });
      } else {
        // Keyword satırında fiyat yok — bir sonraki satıra bak
        // (ML Kit bazen "TOPLAM" ve "*582.80"'ı farklı satırlara koyabiliyor)
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          const nextMatches = nextLine.match(priceRegex);
          if (nextMatches) {
            nextMatches.forEach(m => {
              const parsed = cleanAndParseNumber(m);
              if (parsed) possibleTotals.push(parsed);
            });
          }
        }
      }
      continue;
    }

    // Tesseract gibi item çıkarımı kapalı olan durumlarda satırın geri kalanını (ürünleri) atla
    if (rules && rules.extractItems === false) {
      continue;
    }

    if (excludeRegex.test(line)) {
      if (isUSStyleTax && /(sales\s*tax|state\s*tax|^tax\b)/i.test(line)) {
        let taxMatches = line.match(priceRegex);
        if (taxMatches && taxMatches.length > 0) {
          const parsed = cleanAndParseNumber(taxMatches[taxMatches.length - 1]);
          if (parsed) {
            const taxVal = Math.abs(parsed);
            extractedTaxAmount += taxVal;
            extractedItems.push({
              name: language === 'tr' ? 'Satış Vergisi' : 'Sales Tax',
              price: taxVal,
              type: language === 'tr' ? 'Vergiler' : 'Taxes',
              size: ''
            });
          }
        }
      }
      continue;
    }

    let matches = line.match(priceRegex);
    if (matches && matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      let parsedPrice = cleanAndParseNumber(lastMatch);

      if (parsedPrice) {
        const priceIndex = line.lastIndexOf(lastMatch);
        const charBefore = priceIndex > 0 ? line[priceIndex - 1] : '';
        const charAfter = (priceIndex + lastMatch.length) < line.length ? line[priceIndex + lastMatch.length] : '';
        const isDiscountLine = /(indirim|ndirim|iskonto|discount|saving|promo)/i.test(line) || charBefore === '-' || charAfter === '-';
        if (isDiscountLine) {
          parsedPrice = -Math.abs(parsedPrice);
        }

        let namePart = line.substring(0, line.lastIndexOf(lastMatch)).trim();
        let isGarbageName = namePart.length === 0 || namePart.length <= 4 || /^[%xX\d\s*#\-.,'":;]+$/.test(namePart);

        // Ensure the name has at least 2 actual alphabet letters to not be considered garbage
        const letterMatch = namePart.match(/[a-zA-ZğüşöçıİĞÜŞÖÇ]/g);
        if (!letterMatch || letterMatch.length < 2) isGarbageName = true;

        if (isGarbageName) {
          if (previousOrphanedText) {
            namePart = previousOrphanedText;
            isGarbageName = false;
          } else {
            pendingPrice = parsedPrice;
            continue;
          }
        }

        if (!isGarbageName && namePart.length > 2 && /[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(namePart)) {
          let itemSize = "";
          const sizeMatch = namePart.match(itemSizeRegex);
          if (sizeMatch) {
            itemSize = normalizeSize(sizeMatch[0]);
            namePart = namePart.replace(sizeMatch[0], '').trim();
          }

          let cleaned = namePart
            .replace(/[%*]\s?\d+(?:[.,]\d+)?/g, '')
            .replace(/\b[xX]\s?\d+(?:[.,]\d+)?\b/g, '')
            .replace(/\b\d+\s?[xX]\b/g, '')
            .replace(/[*#%]/g, ' ')
            .replace(/\b(kg|gr|g|l|lt|ml|cl|mg|adet|ad|kc)\b\s*$/i, '')
            .replace(/\s+/g, ' ')
            .trim();

          let formattedName = trTitleCase(cleanItemName(brandAutoCorrect(cleaned)));
          let finalSize = (formattedName.toLowerCase().includes("patates") || formattedName.toLowerCase().includes("kg")) ? globalCachedSize : (itemSize || "");

          const isJustUnitOrMultiplier = /^([oO0-9.,]+\s*)?(kg|gr|g|l|lt|ml|cl|mg|adet|ad|kc)\s*([xX*]\s*[oO0-9.,]*)?$/i.test(formattedName);

          // Ensure the name has at least 2 actual alphabet letters to filter out pure numbers/punctuation (e.g. "3.995")
          const letterMatchFormatted = formattedName.match(/[a-zA-ZğüşöçıİĞÜŞÖÇ]/g);
          const hasEnoughLetters = letterMatchFormatted && letterMatchFormatted.length >= 2;

          if (formattedName.length >= 2 && !isJustUnitOrMultiplier && hasEnoughLetters) {
            extractedItems.push({
              name: formattedName,
              price: parsedPrice,
              size: finalSize || previousOrphanedSize
            });
          }

          previousOrphanedText = "";
          if (finalSize === globalCachedSize) globalCachedSize = "";
        }
      }
    } else {
      if (/[a-zA-ZçğıöşüÇĞİÖŞÜ]{3,}/.test(line)) {
        if (pendingPrice !== null) {
          let itemPrice = pendingPrice;
          const isDiscountLine = /(indirim|ndirim|iskonto|discount|saving|promo)/i.test(line);
          if (isDiscountLine) {
            itemPrice = -Math.abs(itemPrice);
          }

          let itemSize = "";
          const sizeMatch = line.match(itemSizeRegex);
          if (sizeMatch) {
            itemSize = normalizeSize(sizeMatch[0]);
          }

          let cleaned = line
            .replace(/[%*]\s?\d+(?:[.,]\d+)?/g, '')
            .replace(/\b[xX]\s?\d+(?:[.,]\d+)?\b/g, '')
            .replace(/\b\d+\s?[xX]\b/g, '')
            .replace(/[*#%]/g, ' ')
            .replace(/\b(kg|gr|g|l|lt|ml|cl|mg|adet|ad|kc)\b\s*$/i, '')
            .replace(/\s+/g, ' ')
            .trim();

          let formattedName = trTitleCase(cleanItemName(brandAutoCorrect(cleaned)));
          let finalSize = (formattedName.toLowerCase().includes("patates") || formattedName.toLowerCase().includes("kg")) ? globalCachedSize : (itemSize || "");

          const isJustUnitOrMultiplier = /^([oO0-9.,]+\s*)?(kg|gr|g|l|lt|ml|cl|mg|adet|ad|kc)\s*([xX*]\s*[oO0-9.,]*)?$/i.test(formattedName);

          // Ensure the name has at least 2 actual alphabet letters to filter out pure numbers/punctuation (e.g. "3.995")
          const letterMatchFormatted = formattedName.match(/[a-zA-ZğüşöçıİĞÜŞÖÇ]/g);
          const hasEnoughLetters = letterMatchFormatted && letterMatchFormatted.length >= 2;

          if (formattedName.length >= 2 && !isJustUnitOrMultiplier && hasEnoughLetters) {
            extractedItems.push({
              name: formattedName,
              price: itemPrice,
              size: finalSize || previousOrphanedSize
            });
          }

          pendingPrice = null;
          if (finalSize === globalCachedSize) globalCachedSize = "";
        } else {
          previousOrphanedText = line;
        }
      }
    }
  }

  let finalTotal = 0;
  const itemsSum = extractedItems.reduce((acc, item) => acc + item.price, 0);
  const positiveItemsSum = extractedItems.filter(i => i.price > 0).reduce((acc, item) => acc + item.price, 0);
  const targetSum = itemsSum;

  if (possibleTotals.length > 0) {
    // Filter out negative totals — a receipt total is always positive
    const positiveTotals = possibleTotals.filter(t => t > 0);
    const totalsToUse = positiveTotals.length > 0 ? positiveTotals : possibleTotals;

    if (itemsSum > 0) {
      let closest = totalsToUse[0];
      let minDiff = Math.abs(totalsToUse[0] - targetSum);
      for (let i = 1; i < totalsToUse.length; i++) {
        const diff = Math.abs(totalsToUse[i] - targetSum);
        if (diff < minDiff) {
          minDiff = diff;
          closest = totalsToUse[i];
        }
      }

      finalTotal = closest;
    } else {
      finalTotal = Math.max(...totalsToUse);
    }
  } else {
    if (itemsSum > 0) {
      finalTotal = targetSum;
    } else {
      const allMatches = normalizedText.match(priceRegex);
      if (allMatches) {
        const allNumbers = allMatches.map(cleanAndParseNumber).filter(num => num !== null);
        if (allNumbers.length > 0) {
          finalTotal = Math.max(...allNumbers);
        }
      }
    }
  }

  // 🛡️ NEGATIVE TOTAL PROTECTION
  // A receipt total can NEVER be negative. If it is, something went wrong
  // (e.g., only discount lines were detected, real products were missed).
  if (finalTotal <= 0) {
    // Try to use the sum of positive-priced items
    if (positiveItemsSum > 0) {
      finalTotal = positiveItemsSum;
    } else {
      // Last resort: scan all numbers in the text and use the largest one
      const allMatches = normalizedText.match(priceRegex);
      if (allMatches) {
        const allNumbers = allMatches.map(cleanAndParseNumber).filter(num => num !== null && num > 0);
        if (allNumbers.length > 0) {
          finalTotal = Math.max(...allNumbers);
        }
      }
    }
  }

  finalTotal = Math.round(finalTotal * 100) / 100;

  return { total: finalTotal, items: extractedItems, currency: finalCurrency };
};
