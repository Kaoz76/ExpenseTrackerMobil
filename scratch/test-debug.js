import { extractDataFromText } from '../src/utils/ocrUtils.js';
import { tesseractParserRules } from '../src/utils/tesseractParserRules.js';

const rawText1 = `0,53:   KG   x   999,00-B
TK   KÜ   £T   FERMENTE   DA   *534   47
05.02.2026 Saat
E 2732,8`;

console.log("Parsed output:");
const result = extractDataFromText(rawText1, 'tr', 'TRY', tesseractParserRules);
console.log(JSON.stringify(result, null, 2));
