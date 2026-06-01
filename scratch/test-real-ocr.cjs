function extractDataFromText(text, language, defaultCurrencyCode) {
  if (!text) return { total: 0, items: [] };

  const cleanedText = text
    .replace(/(\d+)\s*([.,])\s*(\d+)/g, '$1$2$3')
    .replace(/-\s*(\d+)/g, '-$1');

  let usTaxScore = 0;
  let ukTaxScore = 0;
  let extractedTaxAmount = 0;

  const normalizedText = cleanedText.toLowerCase().replace(/\r/g, '\n');
  const lines = normalizedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  const keywordRegex = /(toplam|topla|oplam|oblam|topam|todlam|\blam\b|total|tutar|amount|odenecek|grand|bakiye|genel|sum|summe|totale|balance|due|nakit|kredi|k\.karti|kart)/i;
  const fuzzyKeywords = ['toplam', 'topla', 'oplam', 'oblam', 'topam', 'todlam', 'lam', 'total', 'tutar', 'amount', 'odenecek', 'grand', 'bakiye', 'genel', 'totale', 'balance', 'due', 'nakit', 'kredi'];
  const excludeRegex = /(kdv|vat|tax|tva|mwst|iva|sales tax|state tax|para ustu|para üstü|change|vak[iı]f|vaz[iı]r|z[iı]raat|garant[iı]|[iıişş]\s*bank|yap[iı]\s*kred[iı]|akbank|halkbank|halk\s*bank|f[iı]nansbank|qnb|den[iı]zbank|teb|kuveyt|enpara|bankkart|bank\s*kart|mastercard|v[iı]sa|maestro|puan|po[iı]nt|kazanc|kazanç|kasa\s*no|f[iı][sş]\s*no|tar[iı]h|saat|teşekkürler|tesekkurler|mali\s*de[gğ]eri\s*yoktur|kas[iı]yer|cash[iı]er|term[iı]nal|sl[iı]p|belge\s*no|mers[iı]s|v\.?d\.?|verg[iı]\s*da[iı]res[iı]|tc\s*k[iı]ml[iı]k|s[iı]c[iı]l\s*no|store\s*no|receipt\s*no|thank\s*you|merci|danke|grazie|tl\/kg|tl\s*\/kg|tl\s*\/\s*kg|tl\/adet|tl\/gr|ettn|refno|ref\s*no|z\s*no)/i;
  const multiplierRegex = /(\d+(?:[.,]\d+)?)\s*(kg|gr|kc|l|ml|adet)\s*(?:[xX*]|tl\/(?:kg|gr|kc)|tg|[\d.,]+(?:\s*tg)?)/i;
  const priceRegex = /\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+[.,]\d{1,2}/g;
  const itemSizeRegex = /\b(\d+(?:[.,]\d+)?)\s*(kg|gr|g|l|lt|ml|cl|mg|adet|ad|kc)\b/i;

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
    if (unit === 'l') return `${val}L`;
    return `${val}${unit}`;
  };

  const cleanAndParseNumber = (valStr) => {
    let cleanStr = valStr.replace(/[^0-9.,-]/g, '').replace(',', '.');
    const num = parseFloat(cleanStr);
    return !isNaN(num) ? num : null;
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip if it's a pure multiplier line (starts with optional weight/quantity prefix, then unit, then multiplier symbol)
    const pureMultiplierRegex = /^\s*[\d:.,\s]*(kg|gr|kc|l|ml|adet)\s*[xX*]/i;
    if (pureMultiplierRegex.test(line)) continue;

    // Direct check for keyword in line or regex match
    const hasKeyword = keywordRegex.test(line) || fuzzyKeywords.some(k => line.includes(k));

    if (hasKeyword) {
      let matches = line.match(priceRegex);
      if (matches) {
        matches.forEach(m => {
          const parsed = cleanAndParseNumber(m);
          if (parsed) possibleTotals.push(parsed);
        });
      }
      continue;
    }

    if (excludeRegex.test(line)) continue;

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
        
        const letterMatch = namePart.match(/[a-zğüşöçı]/g);
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

        if (!isGarbageName && namePart.length > 2 && /[a-zğüşöçı]/.test(namePart)) {
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
            .replace(/\b(kg|gr|g|l|lt|ml|cl|mg|adet|ad|kc)\b/gi, '') // Remove units anywhere
            .replace(/\b[xX*]\b/g, '') // Remove isolated multipliers anywhere
            .replace(/\s+/g, ' ')               
            .trim();

          let formattedName = cleaned.trim();
          let finalSize = (formattedName.toLowerCase().includes("patates") || formattedName.toLowerCase().includes("kg")) ? globalCachedSize : (itemSize || "");

          const isJustUnitOrMultiplier = /^([oO0-9.,]+\s*)?(kg|gr|g|l|lt|ml|cl|mg|adet|ad|kc)\s*([xX*]\s*[oO0-9.,]*)?$/i.test(formattedName);
          const letterMatchFormatted = formattedName.match(/[a-zğüşöçı]/g);
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
    }
  }

  return { total: possibleTotals[0] || 0, items: extractedItems };
}

const rawOcr = `TUR: e-ARSTY FATURA
Fatura/Irsaliye Seri Sıra No
46180010554 İ
MÜSTERİ TCKN:1ililiil1t1i
BYTECH KULAKLIK 420 | 3
«> KESKINOGLU PLC.DO »1 KIS
B.880 KG x 129.95 TL/KG
BANVIT PILIC PIRZOLA %1 «114,
BOL866 KG x 129,95 TL/KG
SBANVIT PILIC PİRZOLA #1 x112, 9
 #6002080179620633
İNDİRİM %1 x-30, 00
MIGROS PLASTIK POSET £20 «1,00
TOPKDV x 3d. 92
LAM x582 . 80`;

const result = extractDataFromText(rawOcr, 'tr', 'TRY');
console.log(JSON.stringify(result, null, 2));
