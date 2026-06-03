// src/utils/mlKitTextUtils.js
//
// ML Kit (Capacitor native) metin yeniden yapılandırma modülü.
// Bu dosya YALNIZCA mobil ML Kit OCR yolunda kullanılır.
// Tesseract (web) tarafı bu dosyadan ETKİLENMEZ.
//
// İyileştirmeler:
// 1. Parçalanmış kutuları birleştirme (overlapping/adjacent box merge)
// 2. Dikey örtüşme oranı (IoU) tabanlı satır gruplama
// 3. Dinamik satır eğimi takibi (per-line linear regression)
// 4. Koordinat tabanlı kelime boşluğu (dynamic word spacing)

// ─── Yardımcı Geometri Fonksiyonları ────────────────────────────────

const getCenter = (item) => {
  const tl = item.topLeft || [0, 0];
  const br = item.bottomRight || [0, 0];
  return { x: (tl[0] + br[0]) / 2, y: (tl[1] + br[1]) / 2 };
};

const getHeight = (item) => {
  const tl = item.topLeft || [0, 0];
  const bl = item.bottomLeft || [0, 0];
  return Math.abs(bl[1] - tl[1]);
};

const getWidth = (item) => {
  const tl = item.topLeft || [0, 0];
  const tr = item.topRight || [0, 0];
  return Math.abs(tr[0] - tl[0]);
};

// Y ekseni ters olabilir (Android ML Kit): bottomLeft.y < topLeft.y
// Bu yüzden min/max ile güvenli hesaplama yapıyoruz
const getTop = (item) => Math.min(item.topLeft?.[1] ?? 0, item.topRight?.[1] ?? 0, item.bottomLeft?.[1] ?? 0, item.bottomRight?.[1] ?? 0);
const getBottom = (item) => Math.max(item.topLeft?.[1] ?? 0, item.topRight?.[1] ?? 0, item.bottomLeft?.[1] ?? 0, item.bottomRight?.[1] ?? 0);
const getLeft = (item) => Math.min(item.topLeft?.[0] ?? 0, item.bottomLeft?.[0] ?? 0);
const getRight = (item) => Math.max(item.topRight?.[0] ?? 0, item.bottomRight?.[0] ?? 0);

/**
 * Y ekseninin ters olup olmadığını algılar.
 * Android ML Kit'te bazen bottomLeft.y < topLeft.y olur (Y=0 üstte değil altta).
 */
function detectYFlipped(detections) {
  for (const det of detections) {
    if (det.topLeft && det.bottomLeft &&
        typeof det.topLeft[1] === 'number' && typeof det.bottomLeft[1] === 'number') {
      if (det.bottomLeft[1] < det.topLeft[1]) return true;
      if (det.bottomLeft[1] > det.topLeft[1]) return false;
    }
  }
  return false;
}

// ─── Medyan hesaplama ───────────────────────────────────────────────

function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ─── 1. Parçalanmış Kutuları Birleştirme ────────────────────────────
// ML Kit bazen aynı kelimeyi iki parça olarak verir (ör: "TOPL" + "AM").
// X ekseninde birbirine çok yakın ve Y ekseninde örtüşen kutuları birleştir.

function mergeOverlappingBoxes(detections) {
  if (detections.length <= 1) return [...detections];

  // X pozisyonuna göre sırala (soldan sağa)
  const sorted = [...detections].sort((a, b) => getLeft(a) - getLeft(b));

  // Medyan karakter genişliğini hesapla (eşik değer için)
  const charWidths = sorted
    .map(d => {
      const w = getWidth(d);
      const textLen = (d.text || '').length;
      return textLen > 0 ? w / textLen : 0;
    })
    .filter(w => w > 0);
  const medCharWidth = median(charWidths) || 10;

  const merged = [];
  const used = new Set();

  for (let i = 0; i < sorted.length; i++) {
    if (used.has(i)) continue;

    // Mevcut kutunun koordinatlarının derin kopyasını al
    let current = {
      ...sorted[i],
      topLeft: [...(sorted[i].topLeft || [0, 0])],
      topRight: [...(sorted[i].topRight || [0, 0])],
      bottomLeft: [...(sorted[i].bottomLeft || [0, 0])],
      bottomRight: [...(sorted[i].bottomRight || [0, 0])],
      text: sorted[i].text || ''
    };

    // Zincirleme birleştirmeyi önlemek için orijinal sağ kenarı sakla
    const originalRight = getRight(sorted[i]);

    for (let j = i + 1; j < sorted.length; j++) {
      if (used.has(j)) continue;

      const other = sorted[j];

      // Dikey örtüşme kontrolü
      const topA = getTop(current);
      const bottomA = getBottom(current);
      const topB = getTop(other);
      const bottomB = getBottom(other);

      const overlapTop = Math.max(topA, topB);
      const overlapBottom = Math.min(bottomA, bottomB);
      const overlap = Math.max(0, overlapBottom - overlapTop);
      const minH = Math.min(bottomA - topA, bottomB - topB);

      if (minH <= 0) continue;
      const overlapRatio = overlap / minH;

      // Yatay yakınlık kontrolü — ORİJİNAL sağ kenarı kullan (zincirleme birleştirme önlenir)
      const leftB = getLeft(other);
      const xGap = leftB - originalRight;

      // Birleştir: yüksek Y örtüşmesi VE kutular gerçekten temas ediyor/örtüşüyor
      // Eşik: 0.3 karakter genişliği (sadece parçalanmış kelimeler, ayrı kelimeler DEĞİL)
      if (overlapRatio > 0.6 && xGap >= -medCharWidth * 0.5 && xGap < medCharWidth * 0.3) {
        current.text = current.text + other.text;
        current.topRight = [...(other.topRight || current.topRight)];
        current.bottomRight = [...(other.bottomRight || current.bottomRight)];
        used.add(j);
      }
    }

    merged.push(current);
  }

  return merged;
}

// ─── 2 & 3. IoU Tabanlı Satır Gruplama + Dinamik Eğim ──────────────

/**
 * Satır grubunun istatistiklerini (ortalama Y, X, yükseklik, eğim) günceller.
 * Eğim için basit lineer regresyon kullanır.
 */
function updateGroupStats(group) {
  const n = group.items.length;
  let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0, sumH = 0;

  group.items.forEach(item => {
    const c = getCenter(item);
    const h = getHeight(item) || 1;
    sumX += c.x;
    sumY += c.y;
    sumXX += c.x * c.x;
    sumXY += c.x * c.y;
    sumH += h;
  });

  group.avgX = sumX / n;
  group.avgY = sumY / n;
  group.avgHeight = sumH / n;

  // Lineer regresyon eğimi: yeterli varyasyon varsa güncelle
  const denom = sumXX - (sumX * sumX) / n;
  if (Math.abs(denom) > 0.0001 && n >= 2) {
    group.slope = (sumXY - (sumX * sumY) / n) / denom;
  }
  // Aksi halde mevcut eğimi koru
}

function groupIntoLines(detections, isYFlipped) {
  // Genel medyan eğimi hesapla (ilk sıralama için)
  const slopes = [];
  detections.forEach(item => {
    if (item.topLeft && item.topRight) {
      const dx = item.topRight[0] - item.topLeft[0];
      const dy = item.topRight[1] - item.topLeft[1];
      if (Math.abs(dx) > 0.0001) slopes.push(dy / dx);
    }
  });
  let medianSlope = median(slopes);

  // Küçük eğimleri sıfırla — kararlı dikey sıralama için
  if (Math.abs(medianSlope) < 0.05) medianSlope = 0;

  // Projeksiyon Y'ye göre yukarıdan aşağıya sırala
  // Y ekseni ters ise sıralamayı da ters çevir
  const sorted = [...detections].sort((a, b) => {
    const cA = getCenter(a);
    const cB = getCenter(b);
    const valA = cA.y - medianSlope * cA.x;
    const valB = cB.y - medianSlope * cB.x;
    return isYFlipped ? (valB - valA) : (valA - valB);
  });

  const lineGroups = [];

  // Koordinat ölçeğini algıla: normalize (0-1) mi yoksa piksel mi?
  const sampleHeight = getHeight(detections[0] || {});
  const isNormalized = sampleHeight < 1;
  const minHeightThreshold = isNormalized ? 0.002 : 2;

  sorted.forEach(item => {
    const itemTop = getTop(item);
    const itemBottom = getBottom(item);
    let itemHeight = itemBottom - itemTop;
    // Minimum yükseklik koruma (koordinat ölçeğine göre)
    itemHeight = Math.max(itemHeight, isNormalized ? 0.02 : 15);
    if (itemHeight < minHeightThreshold) return; // Çok küçük öğeleri atla

    let bestGroup = null;
    let bestOverlap = 0;

    for (const group of lineGroups) {
      // Bu gruptaki öğenin x pozisyonundaki tahmini Y bandını hesapla
      const center = getCenter(item);
      const projectedCenterY = group.avgY + group.slope * (center.x - group.avgX);

      // Grubun Y bandını tahmin et
      const groupHalfH = group.avgHeight / 2;
      const groupTop = projectedCenterY - groupHalfH;
      const groupBottom = projectedCenterY + groupHalfH;

      // Dikey örtüşme oranını hesapla (IoU benzeri)
      const overlapTop = Math.max(itemTop, groupTop);
      const overlapBottom = Math.min(itemBottom, groupBottom);
      const overlap = Math.max(0, overlapBottom - overlapTop);
      const overlapRatio = overlap / Math.min(itemHeight, group.avgHeight);

      if (overlapRatio > bestOverlap && overlapRatio > 0.3) {
        bestOverlap = overlapRatio;
        bestGroup = group;
      }
    }

    if (bestGroup) {
      bestGroup.items.push(item);
      // Dinamik eğim güncellemesi: gruptaki tüm öğelerle yeniden hesapla
      updateGroupStats(bestGroup);
    } else {
      // Yeni satır grubu oluştur
      const center = getCenter(item);
      const dx = (item.topRight && item.topLeft) ? (item.topRight[0] - item.topLeft[0]) : 0;
      const dy = (item.topRight && item.topLeft) ? (item.topRight[1] - item.topLeft[1]) : 0;
      const itemSlope = Math.abs(dx) > 0.0001 ? dy / dx : medianSlope;

      lineGroups.push({
        items: [item],
        avgX: center.x,
        avgY: center.y,
        avgHeight: itemHeight,
        slope: itemSlope
      });
    }
  });

  return lineGroups;
}

// ─── 4. Koordinat Tabanlı Kelime Boşluğu ───────────────────────────

function buildLineText(group, medCharWidth) {
  // Soldan sağa sırala
  const sorted = [...group.items].sort((a, b) => getCenter(a).x - getCenter(b).x);

  if (sorted.length === 0) return '';
  if (sorted.length === 1) return sorted[0].text || '';

  let text = sorted[0].text || '';

  for (let i = 1; i < sorted.length; i++) {
    const prevRight = getRight(sorted[i - 1]);
    const currLeft = getLeft(sorted[i]);
    const gap = currLeft - prevRight;

    // Boşluk miktarını, kelimelerin gerçek mesafesine göre belirle
    if (gap > medCharWidth * 4) {
      // Büyük boşluk: muhtemelen farklı sütunlar (ürün adı ↔ fiyat)
      text += '   ' + (sorted[i].text || '');
    } else if (gap > medCharWidth * 1.5) {
      // Orta boşluk: belirgin ayrım
      text += '  ' + (sorted[i].text || '');
    } else {
      // Normal boşluk veya iç içe: tek boşluk
      text += ' ' + (sorted[i].text || '');
    }
  }

  return text;
}

// ─── Ana Fonksiyon ──────────────────────────────────────────────────

/**
 * ML Kit textDetections dizisinden yapılandırılmış metin oluşturur.
 * 
 * @param {Array} detections - ML Kit'in döndürdüğü textDetections dizisi
 * @returns {string} Satır satır yeniden yapılandırılmış metin
 */
export function reconstructTextFromDetections(detections) {
  if (!detections || detections.length === 0) return '';

  // Bounding box bilgisi yoksa, düz birleştir (fallback)
  if (!detections[0]?.topLeft || typeof detections[0].topLeft[1] === 'undefined') {
    return detections.map(item => item.text).join('\n');
  }

  // Y eksen yönünü algıla (Android'de ters olabilir)
  const isYFlipped = detectYFlipped(detections);

  // Adım 1: Parçalanmış kutuları birleştir
  const mergedDetections = mergeOverlappingBoxes(detections);

  // Medyan karakter genişliğini hesapla (boşluk kararları için)
  const charWidths = mergedDetections
    .map(d => {
      const w = getWidth(d);
      const textLen = (d.text || '').length;
      return textLen > 0 ? w / textLen : 0;
    })
    .filter(w => w > 0);
  const medCharWidth = median(charWidths) || 10;

  // Adım 2 & 3: IoU + dinamik eğimle satırlara grupla
  const lineGroups = groupIntoLines(mergedDetections, isYFlipped);

  // Satır gruplarını yukarıdan aşağıya sırala
  // Y ekseni ters ise sıralamayı da ters çevir
  lineGroups.sort((a, b) => isYFlipped ? (b.avgY - a.avgY) : (a.avgY - b.avgY));

  // Adım 4: Dinamik boşlukla metin oluştur
  const fullText = lineGroups
    .map(group => buildLineText(group, medCharWidth))
    .join('\n');

  return fullText;
}
