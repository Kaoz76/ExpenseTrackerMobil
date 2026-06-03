const Tesseract = require('tesseract.js');
const path = require('path');

const imagePath = path.join(__dirname, '..', 'public', 'text-img.png');
console.log('Testing Tesseract OCR with createWorker on:', imagePath);

(async () => {
  try {
    const worker = await Tesseract.createWorker('eng');
    
    // Pass outputOptions to enable blocks and TSV/layout data
    const result = await worker.recognize(imagePath, {}, {
      blocks: true,
      tsv: true,
      hocr: true
    });
    
    if (result.data) {
      console.log('Keys of result.data:', Object.keys(result.data));
      console.log('Blocks array type/val:', typeof result.data.blocks, result.data.blocks ? result.data.blocks.length : 'null');
      
      const words = [];
      if (result.data.blocks) {
        result.data.blocks.forEach(block => {
          if (block.paragraphs) {
            block.paragraphs.forEach(para => {
              if (para.lines) {
                para.lines.forEach(line => {
                  if (line.words) {
                    words.push(...line.words);
                  }
                });
              }
            });
          }
        });
      }
      console.log('Extracted words count:', words.length);
      if (words.length > 0) {
        console.log('Sample word:', JSON.stringify(words[0].text));
      }
    }
    
    await worker.terminate();
    process.exit(0);
  } catch (err) {
    console.error('Worker OCR Error:', err);
    process.exit(1);
  }
})();
