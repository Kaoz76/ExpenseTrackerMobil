import { extractDataFromText } from '../src/utils/ocrUtils.js';

const ocrText = `1200 B TUKLIMA FUJI PLUS 220    *17,999.00
TOPLAM             *17,999.00`;

const result = extractDataFromText(ocrText, 'tr', 'TRY');
console.log(JSON.stringify(result, null, 2));
