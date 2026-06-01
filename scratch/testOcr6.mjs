import { extractDataFromText } from '../src/utils/ocrUtils.js';

const text = `CAYKUR TOMURCUK CAYI %1 *75,95
NESCAFE CLASSIC 100G %1 *189,00
% 25 INDIRIM %1 *-47,25
BEYAZ PEYNIR 1000G. %1 *255,95
3.995 KG x 21,50 TL/KG
PATATES KG %1 *85,89
MIGROS SUZME YOGURT %1 *125,50
MIGROS SUZME PEYNIR %1 *91,90

TOPKDV *7,69
TOPLAM *776,94`;

const result = extractDataFromText(text, 'tr', 'TRY');
console.log(JSON.stringify(result, null, 2));
