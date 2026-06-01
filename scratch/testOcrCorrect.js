import { extractDataFromText } from '../src/utils/ocrUtils.js';

// Simulate a run where total was read CORRECTLY as 776.94
// But due to a fake/extra item, targetSum is 780.93.
// We want to make sure the parsed total remains the correct 776.94, and is NOT overridden by the fake sum 780.93!
const text = `
CAYKUR TOMURCUK CAYI %1 *75,95
NESCAFE CLASSIC 100G %1 *189,00
% 25 INDIRIM %1 *-47,25
BEYAZ PEYNIR 1000G %1 *255,95
3.995 KG
PATATES KG %1 *85,89
MIGROS SUZME YOGURT %1 *125,50
MIGROS SUZME PEYNIR %1 *91,90
#6002080179620633
TOPKDV *7,69
TOPLAM *776,94
`;

const result = extractDataFromText(text, 'tr', 'TRY');
console.log(JSON.stringify(result, null, 2));
