/**
 * Gemini 2.5 Flash-Lite Service
 * 
 * Enriches OCR-parsed receipt items with AI-detected brand, type, and size.
 * Uses the Gemini REST API directly (no SDK dependency needed).
 */
import { suggestedCategoriesTR, suggestedCategoriesEN } from '../utils/categoryMap';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

/**
 * Helper function to parse JSON from LLM output with extra resilience against syntax issues,
 * trailing commas, missing brackets, or half-cut-off responses.
 * 
 * @param {string} text - Raw string output from LLM
 * @returns {Array<Object>} Parsed items array
 */
const parseResilientJson = (text) => {
  if (!text) return [];

  // 1. Clean markdown formatting
  let cleanText = text.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();

  // 2. Clean trailing commas in objects and arrays (e.g. {a: 1,} or [1,])
  cleanText = cleanText.replace(/,\s*([\]}])/g, '$1');

  // 3. Try standard JSON parsing
  try {
    const result = JSON.parse(cleanText);
    if (Array.isArray(result)) return result;
    if (result && typeof result === 'object') return [result];
  } catch (err) {
    console.warn('Standard JSON.parse failed, attempting resilient recovery...', err);
  }

  // 4. Fallback recovery: extract individual {...} JSON objects using regex
  const list = [];
  const objectMatches = cleanText.match(/\{[^{}]+\}/g);
  if (objectMatches) {
    for (const match of objectMatches) {
      try {
        // Clean trailing commas of the individual object
        const cleanMatch = match.replace(/,\s*([\]}])/g, '$1');
        const parsedObj = JSON.parse(cleanMatch);
        if (parsedObj && typeof parsedObj === 'object') {
          list.push(parsedObj);
        }
      } catch (parseError) {
        // Regex field level extraction as the absolute last resort for corrupt individual objects
        try {
          const indexMatch = match.match(/"index"\s*:\s*(\d+)/);
          const brandMatch = match.match(/"brand"\s*:\s*"([^"]*)"/);
          const typeMatch = match.match(/"type"\s*:\s*"([^"]*)"/);
          const sizeMatch = match.match(/"size"\s*:\s*"([^"]*)"/);
          if (indexMatch) {
            list.push({
              index: parseInt(indexMatch[1], 10),
              brand: brandMatch ? brandMatch[1] : '',
              type: typeMatch ? typeMatch[1] : '',
              size: sizeMatch ? sizeMatch[1] : ''
            });
          }
        } catch (regexError) {
          console.error('Failed to extract fields from corrupt item object:', match, regexError);
        }
      }
    }
  }

  return list;
};

/**
 * Calls Gemini 2.5 Flash-Lite to detect brand, type, and size for each parsed item.
 * 
 * @param {Array<{name: string, price: number}>} items - OCR-parsed items with name and price
 * @param {string} storeName - Optional store name for better context
 * @param {string} language - The user language setting (e.g., 'en', 'tr')
 * @returns {Promise<Array<{name: string, price: number, brand: string, type: string, size: string}>>}
 */
export const enrichItemsWithGemini = async (items, storeName = '', language = 'en') => {
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

  // Build the prompt helper variables
  const itemList = items.map((item, i) => `${i + 1}. "${item.name}" — ${item.price}`).join('\n');
  const langInstruction = language === 'tr' 
    ? `IMPORTANT: You must respond in Turkish. Type categories must be in Turkish using generalized product types (e.g., "Süt Ürünü", "Atıştırmalık", "İçecek", "Temizlik", "Et", "Fırın", "Manav", "Kişisel Bakım", "Dondurulmuş"). Do NOT use specific types like "Peynir" or "Elma", use the general category instead.`
    : `IMPORTANT: You must respond in English. Type categories must be in English using generalized product types (e.g., "Dairy", "Snack", "Beverage", "Cleaning", "Meat", "Bakery", "Produce", "Personal Care", "Frozen"). Do NOT use specific types like "Cheese" or "Apple", use the general category instead.`;

  const exampleResponse = language === 'tr'
    ? `[{"index":1,"brand":"Ülker","type":"Atıştırmalık","size":""},{"index":2,"brand":"Sütaş","type":"Süt Ürünü","size":"1L"}]`
    : `[{"index":1,"brand":"Ülker","type":"Snack","size":""},{"index":2,"brand":"Sütaş","type":"Dairy","size":"1L"}]`;

  // Build system instructions for Gemini prompt caching
  const systemInstructionText = `You are a product data extraction assistant for grocery/retail receipt items.
Given a list of product names parsed from a receipt${storeName ? ` at "${storeName}"` : ''}, detect the brand, type (product category), and size (weight/volume) for each item.

${langInstruction}

Rules:
- The "type" field must EXACTLY match one of the predefined categories listed above.
- If the brand is embedded in the product name (e.g., "Ülker Çikolata"), extract it. Brands must be returned in Title Case (e.g., "Ülker", "Sütaş", "Coca-Cola" instead of "ÜLKER" or "sutas").
- For private-label items from chain stores (e.g., BİM's "Dost" or "Saban", A101's "Birşah"), extract the private-label brand name (e.g., "Dost", "Birşah", "Saban") as the brand. If it's a generic store brand like "Migros Süt", use "Migros".
- Normalize the "size" field using standard lowercase units: "g" for grams, "ml" for milliliters, "L" for liters, "kg" for kilograms. Remove any spaces between the number and unit (e.g., "500g", "250ml", "1L", "1.5kg" instead of "500 GR", "250 ml", "1 lt").
- If you cannot determine a field, return an empty string "".
- Respond ONLY with a valid JSON array, no markdown, no explanation.
- Each element must have: {"index": <number>, "brand": "<string>", "type": "<string>", "size": "<string>"}
- The index is 1-based matching the item number above.

Example response:
${exampleResponse}

JSON:`;

  const userContent = `Items:\n${itemList}`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: userContent,
          }],
        }],
        systemInstruction: {
          parts: [{
            text: systemInstructionText,
          }],
        },
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

    // Resiliently parse the JSON response
    const enrichedData = parseResilientJson(generatedText);

    if (!enrichedData || enrichedData.length === 0) {
      console.warn('Failed to recover any enriched items from Gemini response:', generatedText);
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
        const rawType = (enrichment.type || '').trim();
        // Capitalize the first letter of each word
        const formattedType = rawType.replace(/\b\w/g, l => l.toUpperCase());

        return {
          ...item,
          brand: (enrichment.brand || item.brand || '').trim(),
          type: formattedType || item.type || '',
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
