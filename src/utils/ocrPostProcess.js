// src/utils/ocrPostProcess.js
// Post-processing pipeline for Tesseract.js OCR results on web.
// This module does NOT affect Google ML Kit (mobile) in any way.

/**
 * Common Tesseract OCR character misreads for Turkish receipt text.
 * Maps wrong → correct at the character/pattern level.
 */
const CHAR_CORRECTIONS = [
  // Number ↔ Letter confusions (very common in receipts)
  { pattern: /(?<=[A-ZÇĞİÖŞÜa-zçğıöşü])0(?=[A-ZÇĞİÖŞÜa-zçğıöşü])/g, replacement: 'O' },  // mid-word 0 → O
  { pattern: /(?<=[A-ZÇĞİÖŞÜa-zçğıöşü])1(?=[A-ZÇĞİÖŞÜa-zçğıöşü])/g, replacement: 'l' },  // mid-word 1 → l
  { pattern: /(?<=\d)O(?=\d)/g, replacement: '0' },  // mid-number O → 0
  { pattern: /(?<=\d)l(?=\d)/g, replacement: '1' },   // mid-number l → 1
  { pattern: /(?<=\d)I(?=\d)/g, replacement: '1' },   // mid-number I → 1
  { pattern: /(?<=\d)S(?=\d)/g, replacement: '5' },   // mid-number S → 5
  { pattern: /(?<=\d)B(?=\d)/g, replacement: '8' },   // mid-number B → 8
  { pattern: /(?<=\d)Z(?=\d)/g, replacement: '2' },   // mid-number Z → 2
  
  // Turkish-specific keyword fixes
  { pattern: /\bTOPLAIVI\b/gi, replacement: 'TOPLAM' },
  { pattern: /\bTOPLAM1\b/gi, replacement: 'TOPLAM' },
  { pattern: /\bT0PLAM\b/gi, replacement: 'TOPLAM' },
  { pattern: /\bTOPLAMI\b/gi, replacement: 'TOPLAM' },
  { pattern: /\bTOPLAH\b/gi, replacement: 'TOPLAM' },
  { pattern: /\bTOPLAN\b/gi, replacement: 'TOPLAM' },
  { pattern: /\bTOPIAM\b/gi, replacement: 'TOPLAM' },
  { pattern: /\bT0TAL\b/gi, replacement: 'TOTAL' },
  { pattern: /\bTUTAfl\b/gi, replacement: 'TUTAR' },
  { pattern: /\bTUTAR1\b/gi, replacement: 'TUTAR' },
  { pattern: /\bKOV\b/gi, replacement: 'KDV' },
  { pattern: /\bK0V\b/gi, replacement: 'KDV' },
  { pattern: /\bTOPKOV\b/gi, replacement: 'TOPKDV' },
  { pattern: /\bT0PKDV\b/gi, replacement: 'TOPKDV' },
  { pattern: /\bTOPK0V\b/gi, replacement: 'TOPKDV' },
  
  // Common ligature misreads
  { pattern: /rn(?=[aeiouıöüğçş])/gi, replacement: 'm' }, // rn → m (when followed by vowel)
  { pattern: /\bIVI(?=[A-ZÇĞİÖŞÜa-zçğıöşü])/g, replacement: 'M' }, // IVI → M at word boundary
  { pattern: /\bYl\)/gi, replacement: '' },    // Trailing 'Yl)' garbage from Tesseract
  { pattern: /\bYI\)/gi, replacement: '' },    // Variant of above
  { pattern: /[)\]}>]+$/gm, replacement: '' }, // Trailing brackets/parens on any line
  
  // Commonly misread Turkish words on receipts
  { pattern: /\bNAKlT\b/gi, replacement: 'NAKİT' },
  { pattern: /\bNAK1T\b/gi, replacement: 'NAKİT' },
  { pattern: /\bODENECEK\b/gi, replacement: 'ÖDENECEK' },
  { pattern: /\bODEME\b/gi, replacement: 'ÖDEME' },
  { pattern: /\bURUN\b/gi, replacement: 'ÜRÜN' },
  { pattern: /\bFlYAT\b/gi, replacement: 'FİYAT' },
  { pattern: /\bF1YAT\b/gi, replacement: 'FİYAT' },
  { pattern: /\bINDIRIM\b/gi, replacement: 'İNDİRİM' },
  { pattern: /\b1ND1R1M\b/gi, replacement: 'İNDİRİM' },
  { pattern: /\bAOET\b/gi, replacement: 'ADET' },
  { pattern: /\bAOFT\b/gi, replacement: 'ADET' },
  { pattern: /\bSUZME\b/gi, replacement: 'SÜZME' },
  { pattern: /\bPEYN[1l]R\b/gi, replacement: 'PEYNİR' },
  { pattern: /\bYO[CG]URT\b/gi, replacement: 'YOĞURT' },
  { pattern: /\bTAVU[CK]\b/gi, replacement: 'TAVUK' },
  { pattern: /\bG[O0]GUS\b/gi, replacement: 'GÖĞÜS' },
  { pattern: /\bPIL[1l]C\b/gi, replacement: 'PİLİÇ' },
  { pattern: /\bP[1l]L[1l]C\b/gi, replacement: 'PİLİÇ' },
  { pattern: /\bP[O0]SET\b/gi, replacement: 'POŞET' },
  { pattern: /\bPLAST[1l]K\b/gi, replacement: 'PLASTİK' },
];

/**
 * Fix common price pattern errors from Tesseract.
 * e.g., "1O,5O" → "10,50", "2S,99" → "25,99"
 */
const fixPricePatterns = (text) => {
  // Fix letter-in-number patterns specifically in price contexts
  // Match price-like patterns: digits with possible letter substitutions, comma/dot, 2 digits
  return text.replace(
    /(\d*[OISZB]\d*)[.,](\d*[OISZB]\d*)/g,
    (match) => {
      return match
        .replace(/O/g, '0')
        .replace(/I/g, '1')
        .replace(/S/g, '5')
        .replace(/Z/g, '2')
        .replace(/B/g, '8');
    }
  );
};

/**
 * Apply character-level corrections to raw OCR text.
 * @param {string} text - Raw OCR text from Tesseract
 * @returns {string} Corrected text
 */
const applyCharCorrections = (text) => {
  let corrected = text;
  for (const { pattern, replacement } of CHAR_CORRECTIONS) {
    corrected = corrected.replace(pattern, replacement);
  }
  return corrected;
};

/**
 * Merge broken lines where Tesseract splits a single receipt line into two.
 * Heuristic: if a line has no price pattern and the next line starts with a price,
 * they likely belong together.
 * @param {string[]} lines - Array of text lines
 * @returns {string[]} Merged lines
 */
const mergeBrokenLines = (lines) => {
  const priceRegex = /\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+[.,]\d{1,2}/;
  const merged = [];
  let i = 0;

  while (i < lines.length) {
    const currentLine = lines[i].trim();
    
    if (!currentLine) {
      i++;
      continue;
    }

    // Check if current line has NO price and is mostly text (likely a product name)
    const currentHasPrice = priceRegex.test(currentLine);
    const currentHasLetters = /[a-zA-ZçğıöşüÇĞİÖŞÜ]{2,}/.test(currentLine);
    
    if (!currentHasPrice && currentHasLetters && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      const nextHasPrice = priceRegex.test(nextLine);
      const nextIsShort = nextLine.length < 20;
      
      // If next line is just a price or very short with a price, merge
      if (nextHasPrice && nextIsShort) {
        // Check if next line is ONLY a price (no meaningful text before it)
        const nextWithoutPrice = nextLine.replace(priceRegex, '').trim();
        const nextHasOnlyGarbage = nextWithoutPrice.length < 3 || /^[%*#\-.,\s]+$/.test(nextWithoutPrice);
        
        if (nextHasOnlyGarbage) {
          merged.push(currentLine + '   ' + nextLine);
          i += 2;
          continue;
        }
      }
    }
    
    merged.push(currentLine);
    i++;
  }

  return merged;
};

/**
 * Filter words by Tesseract confidence score.
 * Replaces very low-confidence words with empty string to avoid garbage.
 * @param {Object} tesseractData - Tesseract result.data object
 * @param {number} minWordConfidence - Minimum confidence to keep a word (0-100)
 * @returns {string} Filtered text
 */
const filterByConfidence = (tesseractData, minWordConfidence = 45) => {
  if (!tesseractData || !tesseractData.lines) {
    return tesseractData?.text || '';
  }

  const filteredLines = [];

  for (const line of tesseractData.lines) {
    if (!line.words || line.words.length === 0) continue;

    // Calculate line average confidence
    const lineConfidence = line.words.reduce((sum, w) => sum + w.confidence, 0) / line.words.length;
    
    // Skip entire line if average confidence is very low (likely garbage/noise)
    if (lineConfidence < 25) continue;

    const filteredWords = [];
    for (const word of line.words) {
      if (word.confidence >= minWordConfidence) {
        filteredWords.push(word.text);
      } else if (word.confidence >= 30) {
        // Medium confidence: keep but flag for potential correction
        // For prices, be more lenient since they're critical
        const isPriceWord = /^\d+[.,]?\d*$/.test(word.text);
        if (isPriceWord) {
          filteredWords.push(word.text);
        } else if (word.text.length > 2) {
          // Keep longer words even at medium confidence — they might be product names
          filteredWords.push(word.text);
        }
        // Drop very short low-confidence words (likely OCR artifacts)
      }
    }

    if (filteredWords.length > 0) {
      filteredLines.push(filteredWords.join(' '));
    }
  }

  return filteredLines.join('\n');
};

/**
 * Main post-processing pipeline for Tesseract OCR results.
 * Call this after Tesseract.recognize() and before extractDataFromText().
 * 
 * @param {Object} tesseractResult - Full Tesseract.recognize() result
 * @returns {string} Cleaned and corrected OCR text ready for parsing
 */
export const postProcessTesseractResult = (tesseractResult) => {
  if (!tesseractResult || !tesseractResult.data) {
    return '';
  }

  const { data } = tesseractResult;

  // Step 1: Filter by confidence (uses word-level data)
  let text = filterByConfidence(data);

  // Step 2: Apply character-level corrections
  text = applyCharCorrections(text);

  // Step 3: Fix price patterns
  text = fixPricePatterns(text);

  // Step 4: Merge broken lines
  const lines = text.split('\n');
  const mergedLines = mergeBrokenLines(lines);
  text = mergedLines.join('\n');

  // Step 5: Clean up number-only product names and trailing garbage
  const cleanedLines = text.split('\n').filter(line => {
    const stripped = line.replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]/g, '');
    if (stripped.length === 0) return false;
    
    // Remove lines that are ONLY numbers (like "3.99" being treated as a product name)
    const withoutNumbers = line.replace(/[0-9.,\s%*#\-+x]/gi, '').trim();
    if (withoutNumbers.length < 2) return false;
    
    return true;
  });

  // Step 6: Clean trailing garbage characters from each line
  const finalLines = cleanedLines.map(line => {
    // Remove trailing parentheses, brackets, and isolated punctuation garbage
    // e.g., "Patates Kg Yl)" → "Patates Kg"
    let cleaned = line
      .replace(/\s+[Yy][lI1][)\]]+\s*$/g, '')        // "Yl)" trailing garbage
      .replace(/\s+[)\]}>]+\s*$/g, '')                // trailing brackets
      .replace(/^\s*[*]+\s*/g, '')                     // leading asterisks
      .replace(/\s+[.,;:]+\s*$/g, '')                  // trailing punctuation
      .trim();
    return cleaned;
  }).filter(l => l.length > 0);

  return finalLines.join('\n');
};

/**
 * Get overall confidence score for the OCR result.
 * Useful for showing a warning to the user if OCR quality is poor.
 * @param {Object} tesseractResult - Full Tesseract.recognize() result
 * @returns {number} Average confidence (0-100)
 */
export const getOcrConfidence = (tesseractResult) => {
  if (!tesseractResult?.data?.confidence) return 0;
  return Math.round(tesseractResult.data.confidence);
};
