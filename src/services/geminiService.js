/**
 * Gemini 2.5 Flash-Lite Service
 * 
 * Enriches OCR-parsed receipt items with AI-detected brand, type, and size.
 * Uses the Gemini REST API directly (no SDK dependency needed).
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

/**
 * Calls Gemini 2.5 Flash-Lite to detect brand, type, and size for each parsed item.
 * 
 * @param {Array<{name: string, price: number}>} items - OCR-parsed items with name and price
 * @param {string} storeName - Optional store name for better context
 * @returns {Promise<Array<{name: string, price: number, brand: string, type: string, size: string}>>}
 */
export const enrichItemsWithGemini = async (items, storeName = '') => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    console.warn('Gemini API key not configured. Skipping AI enrichment.');
    return items.map(item => ({
      ...item,
      brand: item.brand || '',
      type: item.type || '',
      size: item.size || '',
    }));
  }

  if (!items || items.length === 0) {
    return [];
  }

  // Build the prompt with item list
  const itemList = items.map((item, i) => `${i + 1}. "${item.name}" — ${item.price}`).join('\n');

  const prompt = `You are a product data extraction assistant for grocery/retail receipt items.
Given the following list of product names parsed from a receipt${storeName ? ` at "${storeName}"` : ''}, detect the **brand**, **type** (product category like "Dairy", "Snack", "Beverage", "Cleaning", "Meat", "Bakery", "Produce", "Frozen", "Personal Care", etc.), and **size** (weight/volume like "1L", "500g", "200ml", "1kg", etc.) for each item.

Items:
${itemList}

Rules:
- If the brand is embedded in the product name (e.g., "Ülker Çikolata"), extract it.
- If size/weight info is in the name (e.g., "Süt 1L"), extract it.
- If you cannot determine a field, return an empty string "".
- Product types should be short category labels (1-2 words max).
- Respond ONLY with a valid JSON array, no markdown, no explanation.
- Each element must have: {"index": <number>, "brand": "<string>", "type": "<string>", "size": "<string>"}
- The index is 1-based matching the item number above.

Example response:
[{"index":1,"brand":"Ülker","type":"Snack","size":""},{"index":2,"brand":"Sütaş","type":"Dairy","size":"1L"}]

JSON:`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt,
          }],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Gemini API error:', response.status, errorBody);
      return items.map(item => ({
        ...item,
        brand: item.brand || '',
        type: item.type || '',
        size: item.size || '',
      }));
    }

    const data = await response.json();

    // Extract the generated text from Gemini's response structure
    const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      console.warn('Gemini returned empty response');
      return items.map(item => ({
        ...item,
        brand: item.brand || '',
        type: item.type || '',
        size: item.size || '',
      }));
    }

    // Parse the JSON response (strip any markdown wrapping if present)
    let enrichedData;
    try {
      const cleanJson = generatedText.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
      enrichedData = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', parseError, generatedText);
      return items.map(item => ({
        ...item,
        brand: item.brand || '',
        type: item.type || '',
        size: item.size || '',
      }));
    }

    // Merge Gemini enrichment data back into the original items
    return items.map((item, idx) => {
      const enrichment = enrichedData.find(e => e.index === idx + 1);
      if (enrichment) {
        return {
          ...item,
          brand: (enrichment.brand || item.brand || '').trim(),
          type: (enrichment.type || item.type || '').trim(),
          size: (enrichment.size || item.size || '').trim(),
        };
      }
      return {
        ...item,
        brand: item.brand || '',
        type: item.type || '',
        size: item.size || '',
      };
    });

  } catch (error) {
    console.error('Gemini API call failed:', error);
    // Graceful fallback: return items without enrichment
    return items.map(item => ({
      ...item,
      brand: item.brand || '',
      type: item.type || '',
      size: item.size || '',
    }));
  }
};
