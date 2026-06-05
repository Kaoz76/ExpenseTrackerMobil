import { extractDataFromText } from '../src/utils/ocrUtils.js';

// OCR text from the screenshots (ML Kit output)
const ocrText = `TCKNVKN: 1183243788
Isin/Unvan: OMER OTÇU
Vergi Dairesi:
Adres: KULLAR
Başiskele / Kocael1
MUsteri Email;
12008TUKL IMAFUJIPLUS 220    17,999. D0
TOPKDV   2,999.83
TOPLAM    17,999.00
Banka Kredi Kartı (6)    17,999.00
YAPI KREDI T:6X2,999.83 TL
I:2687569190 T:00208101 650161es*998
08.06.2024 17:20 B:34 S:59
Onay No:840747 Ref.No: 7051840747
DOS.215000A`;

console.log("=== ML Kit (no rules, default) ===");
const result1 = extractDataFromText(ocrText, 'tr', 'TRY');
console.log("Total:", result1.total);
console.log("Currency:", result1.currency);
console.log("Items:", JSON.stringify(result1.items, null, 2));

console.log("\n=== Tesseract (with tesseractParserRules) ===");
import { tesseractParserRules } from '../src/utils/tesseractParserRules.js';
const result2 = extractDataFromText(ocrText, 'tr', 'TRY', tesseractParserRules);
console.log("Total:", result2.total);
console.log("Currency:", result2.currency);
console.log("Items:", JSON.stringify(result2.items, null, 2));
