const Tesseract = require('tesseract.js');

const imagePath = 'C:\\Users\\kaano\\.gemini\\antigravity-ide\\brain\\5bd15596-07f0-4aba-9dfd-0dfdd1b1092a\\.tempmediaStorage\\media_5bd15596-07f0-4aba-9dfd-0dfdd1b1092a_1780307573056.png';

console.log('Starting OCR on image:', imagePath);

Tesseract.recognize(
  imagePath,
  'tur+eng',
  {
    logger: m => {
      if (m.status === 'recognizing text') {
        console.log(`Progress: ${Math.round(m.progress * 100)}%`);
      }
    }
  }
).then(({ data: { text } }) => {
  console.log('=== OCR RESULT ===');
  console.log(text);
  console.log('==================');
  process.exit(0);
}).catch(err => {
  console.error('OCR Error:', err);
  process.exit(1);
});
