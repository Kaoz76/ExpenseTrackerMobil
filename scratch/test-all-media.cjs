const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');

const dir = 'C:\\Users\\kaano\\.gemini\\antigravity-ide\\brain\\5bd15596-07f0-4aba-9dfd-0dfdd1b1092a\\.tempmediaStorage';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));

async function run() {
  for (const file of files) {
    const filePath = path.join(dir, file);
    console.log(`\n=================== FILE: ${file} ===================`);
    try {
      const { data: { text } } = await Tesseract.recognize(filePath, 'tur+eng');
      console.log(text);
    } catch (err) {
      console.error(`Error on ${file}:`, err);
    }
  }
}

run();
