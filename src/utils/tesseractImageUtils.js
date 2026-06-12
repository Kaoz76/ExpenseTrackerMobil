// src/utils/tesseractImageUtils.js

/**
 * Resizes an image specifically for Tesseract.js.
 * This is a copy of the original resizeImage function, allowing independent tuning.
 * 
 * @param {File} file - Original image file
 * @param {number} maxWidth - Maximum width
 * @param {number} maxHeight - Maximum height
 * @param {number} quality - JPEG compression quality (0 to 1)
 * @returns {Promise<File>} Resized image file
 */
export const resizeImageForTesseract = (file, maxWidth = 1400, maxHeight = 1800, quality = 0.75) => {
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
        // Sınırlara uyuyorsa kaliteyi korumak için orijinal dosyayı doğrudan döndür
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
      }, 'image/jpeg', quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
};

