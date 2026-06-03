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

  const discountCategory = language === 'tr' ? 'İndirim' : 'Discount';
  const normalItems = [];
  const processedItems = items.map((item, index) => {
    const priceVal = parseFloat(item.price);
    if (!isNaN(priceVal) && priceVal < 0) {
      return {
        ...item,
        brand: item.brand || '',
        type: discountCategory,
        size: item.size || '',
      };
    } else {
      normalItems.push({ ...item, originalIndex: index });
      return null;
    }
  });

  if (normalItems.length === 0) {
    return processedItems;
  }

  try {
    const enrichFn = httpsCallable(functions, 'enrichItemsWithGemini');
    const response = await enrichFn({ 
      items: normalItems.map(item => ({ name: item.name, price: item.price })), 
      storeName, 
      language 
    });
    
    const enrichedNormal = response.data;
    let normalIdx = 0;
    
    for (let i = 0; i < items.length; i++) {
      if (processedItems[i] === null) {
        const enrichment = enrichedNormal[normalIdx];
        const originalItem = items[i];
        if (enrichment) {
          processedItems[i] = {
            ...originalItem,
            brand: enrichment.brand || originalItem.brand || '',
            type: enrichment.type || originalItem.type || '',
            size: originalItem.size || '',
          };
        } else {
          processedItems[i] = {
            ...originalItem,
            brand: originalItem.brand || '',
            type: originalItem.type || '',
            size: originalItem.size || '',
          };
        }
        normalIdx++;
      }
    }
    
    return processedItems;
  } catch (error) {
    console.error('Gemini AI enrichment failed, falling back to original items:', error);
    // Graceful fallback: return items without enrichment, and keep discount items as discount
    return items.map((item, index) => {
      if (processedItems[index] !== null) {
        return processedItems[index];
      }
      return {
        ...item,
        brand: item.brand || '',
        type: item.type || '',
        size: item.size || '',
      };
    });
  }
};
