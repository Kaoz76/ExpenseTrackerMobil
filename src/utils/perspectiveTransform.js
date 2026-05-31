// src/utils/perspectiveTransform.js

// Function to calculate the homography matrix using Gaussian elimination
// We map 4 source points to 4 destination points.
function solveHomography(src, dst) {
  // 8 equations for 8 parameters (h11 to h32, h33=1)
  const A = [];
  const B = [];
  
  for (let i = 0; i < 4; i++) {
    const x = src[i].x;
    const y = src[i].y;
    const u = dst[i].x;
    const v = dst[i].y;
    
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    B.push(u);
    
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    B.push(v);
  }
  
  // Gaussian elimination
  const h = solveLinearSystem(A, B);
  h.push(1); // h33 = 1
  return h;
}

// Basic Gaussian elimination
function solveLinearSystem(A, B) {
  const n = 8;
  // Forward elimination
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
        maxRow = k;
      }
    }
    
    // Swap rows
    const tempA = [...A[i]];
    A[i] = A[maxRow];
    A[maxRow] = tempA;
    
    const tempB = B[i];
    B[i] = B[maxRow];
    B[maxRow] = tempB;
    
    // Eliminate
    for (let k = i + 1; k < n; k++) {
      const c = -A[k][i] / A[i][i];
      for (let j = i; j < n; j++) {
        if (i === j) {
          A[k][j] = 0;
        } else {
          A[k][j] += c * A[i][j];
        }
      }
      B[k] += c * B[i];
    }
  }
  
  // Back substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
      sum += A[i][j] * x[j];
    }
    x[i] = (B[i] - sum) / A[i][i];
  }
  
  return x;
}

/**
 * Warps a source image to a rectangular destination canvas based on 4 corner points.
 * @param {HTMLImageElement} img - The source image
 * @param {Array<{x: number, y: number}>} corners - 4 corners: TL, TR, BR, BL in image pixel coordinates
 * @returns {HTMLCanvasElement} - The warped cropped canvas
 */
export function perspectiveWarp(img, corners) {
  // Estimate destination width and height
  const wTop = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y);
  const wBot = Math.hypot(corners[2].x - corners[3].x, corners[2].y - corners[3].y);
  let width = Math.max(wTop, wBot);
  
  const hLeft = Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y);
  const hRight = Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y);
  let height = Math.max(hLeft, hRight);

  // Cap the resolution to 1600px max dimension for optimal OCR performance and JS memory safety
  const MAX_DIMENSION = 1600;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(width, height);
    width *= scale;
    height *= scale;
  }

  width = Math.round(width);
  height = Math.round(height);
  
  const dstCorners = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height }
  ];
  
  // Solve for the inverse homography (from destination rectangle to source quadrilateral)
  const H_inv = solveHomography(dstCorners, corners);
  
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = img.naturalWidth || img.width;
  srcCanvas.height = img.naturalHeight || img.height;
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
  srcCtx.drawImage(img, 0, 0);
  const srcData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
  const srcPixels = srcData.data;
  const srcW = srcCanvas.width;
  const srcH = srcCanvas.height;
  
  const dstCanvas = document.createElement('canvas');
  dstCanvas.width = width;
  dstCanvas.height = height;
  const dstCtx = dstCanvas.getContext('2d');
  const dstData = dstCtx.createImageData(width, height);
  const dstPixels = dstData.data;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Apply inverse homography to find corresponding source pixel
      const w = H_inv[6] * x + H_inv[7] * y + H_inv[8];
      const sx = (H_inv[0] * x + H_inv[1] * y + H_inv[2]) / w;
      const sy = (H_inv[3] * x + H_inv[4] * y + H_inv[5]) / w;
      
      const dstIdx = (y * width + x) * 4;
      
      if (sx >= 0 && sx < srcW - 1 && sy >= 0 && sy < srcH - 1) {
        // Bilinear interpolation
        const x0 = Math.floor(sx);
        const x1 = x0 + 1;
        const y0 = Math.floor(sy);
        const y1 = y0 + 1;
        
        const dx = sx - x0;
        const dy = sy - y0;
        
        for (let c = 0; c < 4; c++) {
          const p00 = srcPixels[(y0 * srcW + x0) * 4 + c];
          const p10 = srcPixels[(y0 * srcW + x1) * 4 + c];
          const p01 = srcPixels[(y1 * srcW + x0) * 4 + c];
          const p11 = srcPixels[(y1 * srcW + x1) * 4 + c];
          
          const val = (p00 * (1 - dx) + p10 * dx) * (1 - dy) +
                      (p01 * (1 - dx) + p11 * dx) * dy;
                      
          dstPixels[dstIdx + c] = val;
        }
      } else {
        // Out of bounds
        dstPixels[dstIdx] = 0;
        dstPixels[dstIdx + 1] = 0;
        dstPixels[dstIdx + 2] = 0;
        dstPixels[dstIdx + 3] = 0; // Transparent
      }
    }
  }
  
  dstCtx.putImageData(dstData, 0, 0);
  return dstCanvas;
}
