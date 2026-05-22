/**
 * Gemini AI Enrichment Service
 * 
 * Proxies calls to a serverless backend function (Firebase Cloud Functions)
 * to keep the Gemini API key secure and off the client.
 */
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

/**
 * Enriches OCR-parsed receipt items by delegating to the backend Cloud Function.
 * 
 * @param {Array<{name: string, price: number}>} items - OCR-parsed items with name and price
 * @param {string} storeName - Optional store name for better context
 * @param {string} language - The user language setting (e.g., 'en', 'tr')
 * @returns {Promise<Array<{name: string, price: number, brand: string, type: string}>>}
 */
export const enrichItemsWithGemini = async (items, storeName = '', language = 'en') => {
  if (!items || items.length === 0) {
    return [];
  }

  try {
    const enrichFn = httpsCallable(functions, 'enrichItemsWithGemini');
    const response = await enrichFn({ items, storeName, language });
    return response.data;
  } catch (error) {
    console.error('Gemini AI enrichment failed, falling back to original items:', error);
    // Graceful fallback: return items without enrichment
    return items.map(item => ({
      ...item,
      brand: item.brand || '',
      type: item.type || '',
      size: item.size || '',
    }));
  }
};
