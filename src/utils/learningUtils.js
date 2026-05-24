// src/utils/learningUtils.js

const LEARNING_MEMORY_KEY = 'expense_tracker_learning_memory';

/**
 * Loads the user's learned corrections from Local Storage.
 * @returns {Record<string, { name: string, type: string, count: number }>}
 */
export const getLearnedCorrections = () => {
  try {
    const data = localStorage.getItem(LEARNING_MEMORY_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Failed to load learning memory:', error);
    return {};
  }
};

/**
 * Saves a new correction to the learning memory.
 * @param {string} originalName - The raw name produced by OCR
 * @param {string} correctedName - The name the user changed it to
 * @param {string} correctedType - The category the user assigned
 */
export const saveCorrection = (originalName, correctedName, correctedType) => {
  if (!originalName || !correctedName) return;
  
  // Normalize original name for better matching
  const key = originalName.trim().toLowerCase();
  if (key.length < 3) return; // Ignore very short generic words

  try {
    const memory = getLearnedCorrections();
    const existing = memory[key];
    
    memory[key] = {
      name: correctedName.trim(),
      type: correctedType || (existing ? existing.type : ''),
      count: existing ? existing.count + 1 : 1,
      lastUpdated: Date.now()
    };
    
    localStorage.setItem(LEARNING_MEMORY_KEY, JSON.stringify(memory));
  } catch (error) {
    console.error('Failed to save correction:', error);
  }
};

/**
 * Scans an array of items and applies any learned corrections before they go to the UI/Backend.
 * @param {Array<{name: string, price: number, type?: string, brand?: string}>} items 
 * @returns {Array<{name: string, price: number, type?: string, brand?: string}>}
 */
export const applyLearnedCorrections = (items) => {
  if (!items || items.length === 0) return items;
  
  const memory = getLearnedCorrections();
  if (Object.keys(memory).length === 0) return items;

  return items.map(item => {
    if (!item.name) return item;
    
    const key = item.name.trim().toLowerCase();
    
    // Exact match lookup
    if (memory[key]) {
      const correction = memory[key];
      return {
        ...item,
        name: correction.name || item.name,
        type: correction.type || item.type,
        // Mark as learned so UI can indicate it
        _isLearned: true 
      };
    }
    
    // Fuzzy match lookup (optional enhancement)
    // Could check if key is very close to a memory key
    
    return item;
  });
};
