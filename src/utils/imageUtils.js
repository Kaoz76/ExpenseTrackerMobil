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
  const size = 150; 
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

  const threshold = Math.max(avgBrightness + 20, 130);

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
    return { unit: '%', x: 5, y: 5, width: 90, height: 90 };
  }

  const marginX = size * 0.03;
  const marginY = size * 0.03;

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
