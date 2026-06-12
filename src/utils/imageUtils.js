// src/utils/imageUtils.js

/**
 * OCR'yi hızlandırmak ve bellek/depolama alanını azaltmak için istemci tarafında görüntü yeniden boyutlandırma.
 * @param {File} file - Orijinal görüntü
 * @param {number} maxWidth - Maksimum genişlik
 * @param {number} maxHeight - Maksimum yükseklik
 * @returns {Promise<File>} Yeniden boyutlandırılmış görüntü
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
      }, 'image/jpeg', 0.75); // Bellek kullanımını azaltmak için kalite düşürüldü
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
};

/**
 * OCR doğruluğunu artırmak için görüntüyü önceden işler.
 * Uygulananlar: Gri Tonlama → Kontrast Artırma → Keskinleştirme
 * @param {File} file - İşlenecek görüntü
 * @returns {Promise<File>} İşlenmiş görüntü
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

      // 1) Gri tonlamaya çevir
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }

      // 2) Gölge kaldırma ve aydınlatma dengeleme
      ctx.putImageData(imageData, 0, 0);
      const shadowBlurRadius = Math.max(30, Math.round(Math.min(w, h) * 0.03));
      const bgCanvas = document.createElement('canvas');
      bgCanvas.width = w;
      bgCanvas.height = h;
      const bgCtx = bgCanvas.getContext('2d');
      bgCtx.filter = `blur(${shadowBlurRadius}px)`;
      bgCtx.drawImage(canvas, 0, 0);
      const bgData = bgCtx.getImageData(0, 0, w, h).data;

      // Gölge etkilerini düzleştir, metin kontrastını koru
      const targetWhite = 200;
      for (let i = 0; i < data.length; i += 4) {
        const bg = bgData[i] || 1; // Sıfıra bölünmeyi önle
        const normalized = Math.min(255, Math.max(0, (data[i] / bg) * targetWhite));
        data[i] = normalized;
        data[i + 1] = normalized;
        data[i + 2] = normalized;
      }

      // 3) Kontrast artırma
      const histogram = new Uint32Array(256);
      for (let i = 0; i < data.length; i += 4) {
        histogram[Math.round(data[i])]++;
      }
      const totalPixels = w * h;
      const lowCut = totalPixels * 0.01;  // En karanlık %1'i yoksay
      const highCut = totalPixels * 0.99; // En aydınlık %1'i yoksay
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

      // 4) Dinamik gama düzeltmesi (orta tonları ayarla)
      let sumBrightness = 0;
      for (let i = 0; i < data.length; i += 4) {
        sumBrightness += data[i];
      }
      const avgBrightness = sumBrightness / (w * h);

      let gamma = 1.0;
      if (avgBrightness < 100) {
        // Karanlık görüntü: Orta tonları aydınlat
        gamma = 0.6 + (avgBrightness / 100) * 0.4;
      } else if (avgBrightness > 200) {
        // Soluk görüntü: Orta tonları karart
        gamma = 1.0 + ((avgBrightness - 200) / 55) * 0.5;
      }

      if (Math.abs(gamma - 1.0) > 0.05) {
        // Hızlı gama uygulaması için arama tablosu oluştur
        const gammaLUT = new Uint8Array(256);
        for (let v = 0; v < 256; v++) {
          gammaLUT[v] = Math.min(255, Math.max(0, Math.round(255 * Math.pow(v / 255, gamma))));
        }
        for (let i = 0; i < data.length; i += 4) {
          data[i] = gammaLUT[data[i]];
          data[i + 1] = gammaLUT[data[i + 1]];
          data[i + 2] = gammaLUT[data[i + 2]];
        }
      }

      // 5) Keskinleştirme (Unsharp mask)
      ctx.putImageData(imageData, 0, 0);

      // Bulanıklaştırılmış bir kopya oluştur
      const blurCanvas = document.createElement('canvas');
      blurCanvas.width = w;
      blurCanvas.height = h;
      const blurCtx = blurCanvas.getContext('2d');
      blurCtx.filter = 'blur(1px)';
      blurCtx.drawImage(canvas, 0, 0);
      const blurData = blurCtx.getImageData(0, 0, w, h).data;

      // Keskinliği uygula
      const sharpStrength = 0.5;
      for (let i = 0; i < data.length; i += 4) {
        const diff = data[i] - blurData[i];
        const sharpened = Math.min(255, Math.max(0, data[i] + sharpStrength * diff));
        data[i] = sharpened;
        data[i + 1] = sharpened;
        data[i + 2] = sharpened;
      }

      ctx.putImageData(imageData, 0, 0);

      // 6) ML Kit'in kenardaki metinleri kaçırmaması için beyaz kenarlık ekle
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
 * Görüntünün kırpılmış bölümünü çıkartır
 */
export const getCroppedImg = (imageElement, crop, fileName) => {
  const canvas = document.createElement('canvas');
  const scaleX = imageElement.naturalWidth / imageElement.width;
  const scaleY = imageElement.naturalHeight / imageElement.height;
  // ML Kit'in kenardaki metinlerde zorlanmaması için dolgu (padding) ekle
  const padding = 40;
  canvas.width = crop.width + (padding * 2);
  canvas.height = crop.height + (padding * 2);
  const ctx = canvas.getContext('2d');

  // Arka planı beyaza boya
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
    }, 'image/jpeg', 0.80); // Bellek tasarrufu için kalite düşürüldü
  });
};

/**
 * Görüntü içindeki fiş sınırlarını akıllıca algılar.
 * Yüzde olarak bir kırpma nesnesi döndürür.
 */
export const getSmartCropBox = (imageElement) => {
  const canvas = document.createElement('canvas');
  const size = 200; // Kenar algılama için yüksek çözünürlük
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

  // Gölgeli fiş kenarlarını yakalamak için düşük eşik
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

  // Sınırlar anlamsızsa varsayılana dön
  if (brightPixels < (size * size * 0.05) || brightPixels > (size * size * 0.95)) {
    return { unit: '%', x: 3, y: 3, width: 94, height: 94 };
  }

  // Kenarlarda metin kesilmemesi için pay bırak (%8)
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
 * Görüntüyü saat yönünde 90 derece döndürür ve yeni bir URL döndürür.
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

