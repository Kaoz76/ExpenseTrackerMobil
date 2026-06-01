// src/utils/imageUtils.js

/**
 * Client-side image resizing to speed up OCR and reduce memory/storage footprint
 * @param {File} file - Original image file
 * @param {number} maxWidth - Maximum width
 * @param {number} maxHeight - Maximum height
 * @returns {Promise<File>} Resized image file
 */
export const resizeImage = (file, maxWidth = 1500, maxHeight = 2000) => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      } else {
        resolve(file);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(file);
          return;
        }
        const resizedFile = new File([blob], file.name, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        resolve(resizedFile);
      }, 'image/jpeg', 0.75); // Reduced from 0.85 to decrease memory usage
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
};

/**
 * Preprocesses an image for optimal OCR accuracy.
 * Applies: Grayscale → Contrast Enhancement → Sharpening
 * @param {File} file - Image file to preprocess
 * @returns {Promise<File>} Preprocessed image file
 */
export const preprocessForOCR = (file) => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      // 1) Convert to grayscale
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }

      // 2) Contrast enhancement (percentile-based histogram stretch, ignoring outlier pixels)
      const histogram = new Uint32Array(256);
      for (let i = 0; i < data.length; i += 4) {
        histogram[Math.round(data[i])]++;
      }
      const totalPixels = w * h;
      const lowCut = totalPixels * 0.01;  // ignore darkest 1%
      const highCut = totalPixels * 0.99; // ignore brightest 1%
      let cumulative = 0;
      let minVal = 0, maxVal = 255;
      for (let i = 0; i < 256; i++) {
        cumulative += histogram[i];
        if (cumulative >= lowCut) { minVal = i; break; }
      }
      cumulative = 0;
      for (let i = 0; i < 256; i++) {
        cumulative += histogram[i];
        if (cumulative >= highCut) { maxVal = i; break; }
      }
      const range = maxVal - minVal || 1;
      for (let i = 0; i < data.length; i += 4) {
        const stretched = Math.min(255, Math.max(0, ((data[i] - minVal) / range) * 255));
        data[i] = stretched;
        data[i + 1] = stretched;
        data[i + 2] = stretched;
      }

      // 3) Sharpening (unsharp mask: original + strength * (original - blurred))
      ctx.putImageData(imageData, 0, 0);

      // Create a blurred copy
      const blurCanvas = document.createElement('canvas');
      blurCanvas.width = w;
      blurCanvas.height = h;
      const blurCtx = blurCanvas.getContext('2d');
      blurCtx.filter = 'blur(1px)';
      blurCtx.drawImage(canvas, 0, 0);
      const blurData = blurCtx.getImageData(0, 0, w, h).data;

      // Apply unsharp mask
      const sharpStrength = 0.5;
      for (let i = 0; i < data.length; i += 4) {
        const diff = data[i] - blurData[i];
        const sharpened = Math.min(255, Math.max(0, data[i] + sharpStrength * diff));
        data[i] = sharpened;
        data[i + 1] = sharpened;
        data[i + 2] = sharpened;
      }

      ctx.putImageData(imageData, 0, 0);

      // 4) Add white padding border so ML Kit doesn't miss edge text
      const padding = 30;
      const paddedCanvas = document.createElement('canvas');
      paddedCanvas.width = w + padding * 2;
      paddedCanvas.height = h + padding * 2;
      const paddedCtx = paddedCanvas.getContext('2d');
      paddedCtx.fillStyle = '#ffffff';
      paddedCtx.fillRect(0, 0, paddedCanvas.width, paddedCanvas.height);
      paddedCtx.drawImage(canvas, padding, padding);

      paddedCanvas.toBlob((blob) => {
        if (!blob) {
          resolve(file);
          return;
        }
        resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
      }, 'image/jpeg', 0.92);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
};

/**
 * Web-specific preprocessing pipeline optimized for Tesseract.js OCR.
 * More aggressive than preprocessForOCR() because Tesseract needs:
 * - Higher resolution (300+ DPI effective)
 * - Cleaner binarization (adaptive thresholding)
 * - Less noise (median filter)
 * 
 * Does NOT affect ML Kit (mobile) — this is only called on web.
 * @param {File} file - Image file to preprocess
 * @returns {Promise<File>} Preprocessed image file optimized for Tesseract
 */
export const preprocessForTesseract = (file) => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;

      // 1) Upscale 2x for better Tesseract accuracy (effective 300+ DPI)
      // Cap at 4000px max dimension to avoid memory issues
      const scaleFactor = Math.min(2, 4000 / Math.max(origW, origH));
      const w = Math.round(origW * scaleFactor);
      const h = Math.round(origH * scaleFactor);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      // Use high-quality image smoothing for upscaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      // 2) Convert to grayscale
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }

      // 3) Median filter for noise reduction (3x3 kernel)
      // Creates a copy, applies median to reduce salt-and-pepper noise
      const filtered = new Uint8ClampedArray(data.length);
      for (let i = 0; i < data.length; i++) filtered[i] = data[i];
      
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const neighbors = [];
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const idx = ((y + dy) * w + (x + dx)) * 4;
              neighbors.push(data[idx]);
            }
          }
          neighbors.sort((a, b) => a - b);
          const median = neighbors[4]; // Middle of 9 values
          const idx = (y * w + x) * 4;
          filtered[idx] = median;
          filtered[idx + 1] = median;
          filtered[idx + 2] = median;
        }
      }
      
      // Copy filtered data back
      for (let i = 0; i < data.length; i += 4) {
        data[i] = filtered[i];
        data[i + 1] = filtered[i + 1];
        data[i + 2] = filtered[i + 2];
      }

      // 4) Adaptive thresholding (local mean with window)
      // Better than global threshold for receipts with uneven lighting/shadows
      const blockSize = 25; // Size of local neighborhood
      const C = 12; // Constant subtracted from mean (controls sensitivity)
      const halfBlock = Math.floor(blockSize / 2);
      
      // Build integral image for fast local mean computation
      const integral = new Float64Array(w * h);
      for (let y = 0; y < h; y++) {
        let rowSum = 0;
        for (let x = 0; x < w; x++) {
          rowSum += data[(y * w + x) * 4];
          integral[y * w + x] = rowSum + (y > 0 ? integral[(y - 1) * w + x] : 0);
        }
      }

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const x1 = Math.max(0, x - halfBlock);
          const y1 = Math.max(0, y - halfBlock);
          const x2 = Math.min(w - 1, x + halfBlock);
          const y2 = Math.min(h - 1, y + halfBlock);
          
          const count = (x2 - x1 + 1) * (y2 - y1 + 1);
          
          // Sum using integral image
          let sum = integral[y2 * w + x2];
          if (x1 > 0) sum -= integral[y2 * w + (x1 - 1)];
          if (y1 > 0) sum -= integral[(y1 - 1) * w + x2];
          if (x1 > 0 && y1 > 0) sum += integral[(y1 - 1) * w + (x1 - 1)];
          
          const localMean = sum / count;
          const idx = (y * w + x) * 4;
          const pixel = data[idx];
          
          // Binarize: black text on white background
          const threshold = localMean - C;
          const val = pixel < threshold ? 0 : 255;
          data[idx] = val;
          data[idx + 1] = val;
          data[idx + 2] = val;
        }
      }

      ctx.putImageData(imageData, 0, 0);

      // 5) Morphological dilation (1px) — thicken thin receipt font strokes
      // Receipt printers produce very thin characters that Tesseract struggles with.
      // Dilation expands black pixels by 1px, making characters bolder.
      const dilatedData = ctx.getImageData(0, 0, w, h);
      const dilPx = dilatedData.data;
      const origSnapshot = new Uint8ClampedArray(dilPx.length);
      for (let i = 0; i < dilPx.length; i++) origSnapshot[i] = dilPx[i];

      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = (y * w + x) * 4;
          // If any neighbor in 3x3 is black (0), set this pixel to black
          let hasBlack = false;
          for (let dy = -1; dy <= 1 && !hasBlack; dy++) {
            for (let dx = -1; dx <= 1 && !hasBlack; dx++) {
              const nIdx = ((y + dy) * w + (x + dx)) * 4;
              if (origSnapshot[nIdx] === 0) hasBlack = true;
            }
          }
          if (hasBlack) {
            dilPx[idx] = 0;
            dilPx[idx + 1] = 0;
            dilPx[idx + 2] = 0;
          }
        }
      }
      ctx.putImageData(dilatedData, 0, 0);

      // 6) Add generous white padding (Tesseract performs better with padding)
      const padding = 40;
      const paddedCanvas = document.createElement('canvas');
      paddedCanvas.width = w + padding * 2;
      paddedCanvas.height = h + padding * 2;
      const paddedCtx = paddedCanvas.getContext('2d');
      paddedCtx.fillStyle = '#ffffff';
      paddedCtx.fillRect(0, 0, paddedCanvas.width, paddedCanvas.height);
      paddedCtx.drawImage(canvas, padding, padding);

      paddedCanvas.toBlob((blob) => {
        if (!blob) {
          resolve(file);
          return;
        }
        resolve(new File([blob], file.name, { type: 'image/png', lastModified: Date.now() }));
      }, 'image/png'); // PNG for lossless — critical for binarized text
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
};

/**
 * Extract cropped portion of image
 */
export const getCroppedImg = (imageElement, crop, fileName) => {
  const canvas = document.createElement('canvas');
  const scaleX = imageElement.naturalWidth / imageElement.width;
  const scaleY = imageElement.naturalHeight / imageElement.height;
  // Add padding so ML Kit doesn't struggle with edge text
  const padding = 40;
  canvas.width = crop.width + (padding * 2);
  canvas.height = crop.height + (padding * 2);
  const ctx = canvas.getContext('2d');

  // Fill background with white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.drawImage(
    imageElement,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    padding,
    padding,
    crop.width,
    crop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('Canvas is empty'));
        return;
      }
      blob.name = fileName;
      const file = new File([blob], fileName, { type: 'image/jpeg', lastModified: Date.now() });
      resolve(file);
    }, 'image/jpeg', 0.80); // Reduced from 1.0 to compress cropped files and save memory
  });
};

/**
 * Smartly detect the bounds of the receipt within the image.
 * Returns a crop object in percentages.
 */
export const getSmartCropBox = (imageElement) => {
  const canvas = document.createElement('canvas');
  const size = 200; // Higher resolution for better edge detection
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  ctx.drawImage(imageElement, 0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;

  let totalBrightness = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    totalBrightness += (r + g + b) / 3;
  }
  const avgBrightness = totalBrightness / (size * size);

  // Lower threshold to catch shadowed receipt edges
  const threshold = Math.max(avgBrightness * 0.85, 90);

  let minX = size, minY = size, maxX = 0, maxY = 0;
  let brightPixels = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const brightness = (r + g + b) / 3;
      
      if (brightness > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        brightPixels++;
      }
    }
  }

  // Fallback if bounds are meaningless
  if (brightPixels < (size * size * 0.05) || brightPixels > (size * size * 0.95)) {
    return { unit: '%', x: 3, y: 3, width: 94, height: 94 };
  }

  // Generous margin (8%) to ensure no text is clipped at edges
  const marginX = size * 0.08;
  const marginY = size * 0.08;

  minX = Math.max(0, minX - marginX);
  minY = Math.max(0, minY - marginY);
  maxX = Math.min(size, maxX + marginX);
  maxY = Math.min(size, maxY + marginY);

  return {
    unit: '%',
    x: (minX / size) * 100,
    y: (minY / size) * 100,
    width: ((maxX - minX) / size) * 100,
    height: ((maxY - minY) / size) * 100
  };
};

/**
 * Rotates an image by 90 degrees clockwise and returns a new Object URL.
 */
export const rotateImage90Deg = (imageSrc) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalHeight || img.height;
      canvas.height = img.naturalWidth || img.width;
      const ctx = canvas.getContext('2d');
      
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(90 * Math.PI / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        resolve(URL.createObjectURL(blob));
      }, 'image/jpeg', 0.95);
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
};
