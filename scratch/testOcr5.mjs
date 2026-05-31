import { extractDataFromText } from '../src/utils/ocrUtils.js';

const text = `1200BTUKLIMAFUJIPLUS 220    *17,999.00
TOPKDV                       *2,999.83
TOPLAM                      *17,999.00
Banka Kredi Karti (6)        17,999.00`;

const result = extractDataFromText(text, 'tr', 'TRY');
console.log(JSON.stringify(result, null, 2));
