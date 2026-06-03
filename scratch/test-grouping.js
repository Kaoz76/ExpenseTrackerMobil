const groupTesseractWordsIntoLines = (words) => {
  if (!words || words.length === 0) return "";

  // Map Tesseract bbox to standard format: topLeft, topRight, bottomLeft, bottomRight
  const detections = words.map(w => {
    const { x0, y0, x1, y1 } = w.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 };
    return {
      text: w.text || "",
      topLeft: [x0, y0],
      topRight: [x1, y0],
      bottomLeft: [x0, y1],
      bottomRight: [x1, y1]
    };
  });

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

  // Detect Y-axis orientation
  let isYFlipped = false;
  for (let det of detections) {
    if (det.topLeft && det.bottomLeft && typeof det.topLeft[1] === 'number' && typeof det.bottomLeft[1] === 'number') {
      if (det.bottomLeft[1] < det.topLeft[1]) {
        isYFlipped = true;
        break;
      }
    }
  }

  // Calculate median slope
  let slopes = [];
  detections.forEach(item => {
    if (item.topLeft && item.topRight) {
      let dx = item.topRight[0] - item.topLeft[0];
      let dy = item.topRight[1] - item.topLeft[1];
      if (Math.abs(dx) > 0.0001) slopes.push(dy / dx);
    }
  });
  slopes.sort((a, b) => a - b);
  let medianSlope = slopes.length > 0 ? slopes[Math.floor(slopes.length / 2)] : 0;

  if (Math.abs(medianSlope) < 0.05) medianSlope = 0;

  // Sort top-to-bottom
  detections.sort((a, b) => {
    let cA = getCenter(a);
    let cB = getCenter(b);
    let valA = cA.y - medianSlope * cA.x;
    let valB = cB.y - medianSlope * cB.x;
    return isYFlipped ? (valB - valA) : (valA - valB);
  });

  let lineGroups = [];

  detections.forEach(item => {
    let center = getCenter(item);
    let itemHeight = getHeight(item);
    const minHeight = itemHeight < 1 ? 0.02 : 15;
    const effectiveHeight = Math.max(itemHeight, minHeight);

    let added = false;
    for (let group of lineGroups) {
      let projectedY = group.startY + medianSlope * (center.x - group.startX);
      const compareHeight = Math.max(effectiveHeight, group.height || effectiveHeight);
      const tolerance = compareHeight * 0.5;

      if (Math.abs(center.y - projectedY) < tolerance) {
        group.items.push(item);
        group.height = Math.max(group.height || 0, effectiveHeight);
        added = true;
        break;
      }
    }

    if (!added) {
      let dx = (item.topRight && item.topLeft) ? (item.topRight[0] - item.topLeft[0]) : 0;
      let dy = (item.topRight && item.topLeft) ? (item.topRight[1] - item.topLeft[1]) : 0;
      let itemSlope = Math.abs(dx) > 0.0001 ? dy / dx : medianSlope;

      lineGroups.push({
        startX: center.x,
        startY: center.y,
        slope: itemSlope,
        height: effectiveHeight,
        items: [item]
      });
    }
  });

  // Sort left-to-right within each line and join with triple spaces
  return lineGroups.map(group => {
    group.items.sort((a, b) => getCenter(a).x - getCenter(b).x);
    return group.items.map(i => i.text).join('   ');
  }).join('\n');
};

// Mock data: A typical receipt with products on left and prices on right, slightly tilted
const mockWords = [
  { text: "EKMEK", bbox: { x0: 10, y0: 100, x1: 60, y1: 120 } },
  { text: "15.00", bbox: { x0: 300, y0: 102, x1: 350, y1: 122 } },
  
  { text: "SÜT", bbox: { x0: 10, y0: 130, x1: 40, y1: 150 } },
  { text: "32.50", bbox: { x0: 300, y0: 131, x1: 350, y1: 151 } },
  
  { text: "TOPLAM", bbox: { x0: 10, y0: 165, x1: 80, y1: 185 } },
  { text: "47.50", bbox: { x0: 300, y0: 166, x1: 350, y1: 186 } }
];

console.log("Input mock words structure:\n", JSON.stringify(mockWords, null, 2));
console.log("\nReconstructed lines output:\n");
const result = groupTesseractWordsIntoLines(mockWords);
console.log(result);

// Simple assertion to verify they grouped correctly on the same line
const lines = result.split('\n');
if (lines[0].includes("EKMEK") && lines[0].includes("15.00") &&
    lines[1].includes("SÜT") && lines[1].includes("32.50") &&
    lines[2].includes("TOPLAM") && lines[2].includes("47.50")) {
  console.log("\nPASSED: Layout grouping matched items and prices onto the same lines!");
} else {
  console.error("\nFAILED: Layout grouping did not cluster lines correctly.");
  process.exit(1);
}
