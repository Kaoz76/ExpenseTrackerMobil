import { extractDataFromText } from '../src/utils/ocrUtils.js';

// Simulate ML Kit output with the two bugs reported by the user:
// 1. Müşteri TCKN line exists.
// 2. 3.995 quantity parsed as 3.99.
// 3. Total is misread as 76.94 (instead of 776.94).
const text = `
BILGE FISI
Bilgt Fsi
MÜSTERİ TCKN: 11111111111
CAYKUR TOMURCUK CAYI %1 *75,95
NESCAFE CLASSIC 100G %1 *189,00
% 25 INDIRIM %1 *-47,25
BEYAZ PEYNIR 1000G %1 *255,95
3.995
PATATES KG %1 *85,89
MIGROS SUZME YOGURT %1 *125,50
MIGROS SUZME PEYNIR %1 *91,90
#6002080179620633
TOPKDV *7,69
TOPLAM *76,94
`;

const result = extractDataFromText(text, 'tr', 'TRY');
console.log(JSON.stringify(result, null, 2));
