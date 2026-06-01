import { extractDataFromText } from '../src/utils/ocrUtils.js';

const text = `RefNo : IN32026000010365
ETTN : 3a0b59e-8702-f111-8abe-4062312d9dc9
TK LAHNE 200 G *55,00
TK KASAP SUCUK *339,00
SUTAS KASAR PEYNIRI *279,00
TARIS TAM YAGLI KAS *249,00
0,535 KG x 999,00
TK KUFURT FERMENTE DA *534,47
TK CIFTE KAVRULMUS T *199,90
TK YAGLI DANA KI *299,00
TK RIVIERA ZEYTINYAG *585,00
TK TOZ SEKER 2 KG *87,50
UNO GELENEKSEL LAVAS *105,00
Toplam KDV : 27,06
Toplam    : 2732,87
VAKIT : BANK
KDV       KDV Dahil       KDV Tutar
%1        2732,87         *27,06`;

const result = extractDataFromText(text, 'tr', 'TRY');
console.log(JSON.stringify(result, null, 2));
