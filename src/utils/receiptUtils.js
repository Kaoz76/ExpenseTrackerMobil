

// YAZIM HATALARINA KARŞI: Levenshtein Distance (Bulanık Eşleştirme) Algoritması
export const levenshteinDistance = (s, t) => {
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const arr = [];
  for (let i = 0; i <= t.length; i++) {
    arr[i] = [i];
    for (let j = 1; j <= s.length; j++) {
      arr[i][j] = i === 0 ? j : Math.min(
        arr[i - 1][j] + 1,
        arr[i][j - 1] + 1,
        arr[i - 1][j - 1] + (s[j - 1] === t[i - 1] ? 0 : 1)
      );
    }
  }
  return arr[t.length][s.length];
};

export const isFuzzyMatch = (line, targetWords, maxDist = 2) => {
  const words = line.replace(/[^a-z0-9ğüşöçığ]/gi, ' ').split(/\s+/).filter(w => w.length > 4);
  for (let word of words) {
    for (let target of targetWords) {
      // Word must be similar length to target (within ±2 chars) to avoid false positives
      if (Math.abs(word.length - target.length) > 2) continue;
      const allowedDist = target.length <= 5 ? 1 : maxDist;
      if (levenshteinDistance(word, target) <= allowedDist) {
        return true;
      }
    }
  }
  return false;
};
