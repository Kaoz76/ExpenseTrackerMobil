const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

// Define Gemini API key as a secure secret
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// Suggested categories lists
const suggestedCategoriesTR = [
  'Abonelik', 'Akaryakıt', 'Alkol & Tütün', 'Ayakkabı', 'Bebek',
  'Diğer', 'Eczane', 'Eğitim', 'Eğlence', 'Elektronik', 'Ev',
  'Evcil Hayvan', 'Fatura', 'Gıda', 'Giyim', 'Hobi', 'Kafe', 'Kira',
  'Kozmetik', 'Kitap', 'Kırtasiye', 'Market', 'Mobilya', 'Moda',
  'Oyun', 'Restoran', 'Sağlık', 'Spor', 'Taksi', 'Teknoloji',
  'Ulaşım', 'Vergiler', 'Yazılım', 'Yemek'
];

const suggestedCategoriesEN = [
  'Alcohol & Tobacco', 'Baby', 'Bills', 'Books', 'Cafe', 'Clothing',
  'Cosmetics', 'Dining', 'Education', 'Electronics', 'Entertainment',
  'Fashion', 'Food', 'Fuel', 'Furniture', 'Gaming', 'Grocery',
  'Health', 'Hobby', 'Home', 'Other', 'Pet', 'Pharmacy', 'Rent',
  'Restaurant', 'Shoes', 'Software', 'Sports', 'Stationery',
  'Taxi', 'Technology', 'Taxes', 'Transport'
];

// Title case utility for Turkish/English compatibility
const trTitleCase = (str) => {
  if (typeof str !== 'string') return "";
  return str
    .toLocaleLowerCase("tr-TR")
    .split(' ')
    .map(word => {
      if (!word) return "";
      return word.charAt(0).toLocaleUpperCase("tr-TR") + word.slice(1);
    })
    .join(' ');
};

// Resilient JSON parser to recover LLM output
const parseResilientJson = (text) => {
  if (!text) return [];

  let cleanText = text.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
  cleanText = cleanText.replace(/,\s*([\]}])/g, '$1');

  try {
    const result = JSON.parse(cleanText);
    if (Array.isArray(result)) return result;
    if (result && typeof result === 'object') return [result];
  } catch (err) {
    console.warn('Standard JSON.parse failed, attempting resilient recovery...', err);
  }

  const list = [];
  const objectMatches = cleanText.match(/\{[^{}]+\}/g);
  if (objectMatches) {
    for (const match of objectMatches) {
      try {
        const cleanMatch = match.replace(/,\s*([\]}])/g, '$1');
        const parsedObj = JSON.parse(cleanMatch);
        if (parsedObj && typeof parsedObj === 'object') {
          list.push(parsedObj);
        }
      } catch {
        try {
          const indexMatch = match.match(/"index"\s*:\s*(\d+)/);
          const brandMatch = match.match(/"brand"\s*:\s*"([^"]*)"/);
          const typeMatch = match.match(/"type"\s*:\s*"([^"]*)"/);
          if (indexMatch) {
            list.push({
              index: parseInt(indexMatch[1], 10),
              brand: brandMatch ? brandMatch[1] : '',
              type: typeMatch ? typeMatch[1] : ''
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
 * Cloud Function to enrich OCR-parsed items with Gemini AI.
 * Invoked client-side using httpsCallable(functions, 'enrichItemsWithGemini').
 */
exports.enrichItemsWithGemini = onCall({ secrets: [geminiApiKey] }, async (request) => {
  // 1. Authenticate check
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in to call this function.");
  }

  const { items, storeName = '', language = 'en' } = request.data;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return [];
  }

  const apiKey = geminiApiKey.value();
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "Gemini API key secret is not configured on server.");
  }

  const itemList = items.map((item, i) => `${i + 1}. "${item.name}" — ${item.price}`).join('\n');
  const categoriesList = language === 'tr' ? suggestedCategoriesTR : suggestedCategoriesEN;
  const categoriesStr = categoriesList.map(c => `"${c}"`).join(', ');

  const langInstruction = language === 'tr' 
    ? `IMPORTANT: You must respond in Turkish. The "type" field must be EXACTLY one of these categories: ${categoriesStr}. Do NOT create new categories. If unsure, use "Market", "Gıda" or "Diğer".`
    : `IMPORTANT: You must respond in English. The "type" field must be EXACTLY one of these categories: ${categoriesStr}. Do NOT create new categories. If unsure, use "Grocery", "Food" or "Other".`;

  const exampleResponse = language === 'tr'
    ? `[{"index":1,"brand":"Ülker","type":"Gıda"},{"index":2,"brand":"Ariel","type":"Market"}]`
    : `[{"index":1,"brand":"Ülker","type":"Food"},{"index":2,"brand":"Ariel","type":"Grocery"}]`;

  const systemInstructionText = `You are a product data extraction assistant for grocery/retail receipt items.
Given a list of product names parsed from a receipt${storeName ? ` at "${storeName}"` : ''}, detect the brand and type (product category) for each item.

${langInstruction}

Rules:
- The "type" field must EXACTLY match one of the predefined categories listed above.
- For alcohol and tobacco products, set the category to "Alkol & Tütün" (or "Alcohol & Tobacco").
- Plastic bags ("POŞET", "PLASTIC BAG") or bottle/can deposits ("DEPOZİTO", "DEPOSIT") must have category set to "Diğer" (or "Other") and brand left empty "".
- If the item name represents tax line items ("KDV", "TAX", "SALES TAX"), set the category to "Vergiler" (or "Taxes") and brand to empty "".
- If the brand is embedded in the product name (e.g., "Ülker Çikolata"), extract it. Brands must be returned in Title Case.
- If you cannot determine a field, return an empty string "".
- Respond ONLY with a valid JSON array.
- Each element must have: {"index": <number>, "brand": "<string>", "type": "<string>"}

Example response:
${exampleResponse}

JSON:`;

  const userContent = `Items:\n${itemList}`;
  const models = [
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-1.5-flash'
  ];

  let lastError = null;
  let responseData = null;

  for (const model of models) {
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: userContent }],
            }],
            systemInstruction: {
              parts: [{ text: systemInstructionText }],
            },
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 2048,
              responseMimeType: 'application/json',
            },
          }),
        });

        if (response.ok) {
          responseData = await response.json();
          break;
        }

        const errorBody = await response.text();
        lastError = { status: response.status, body: errorBody };
        console.warn(`Gemini API error (model: ${model}, status: ${response.status}):`, errorBody);

        if (response.status === 503 || response.status === 429) {
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
        }
        break;
      } catch (fetchErr) {
        lastError = fetchErr;
        console.warn(`Network/fetch failed for Gemini API (model: ${model}):`, fetchErr);
        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    if (responseData) {
      break;
    }
  }

  if (!responseData) {
    console.error('All Gemini API models failed. Last error:', lastError);
    return items.map(item => ({
      ...item,
      brand: item.brand || '',
      type: item.type || '',
      size: item.size || '',
    }));
  }

  try {
    const generatedText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedText) {
      return items.map(item => ({
        ...item,
        brand: item.brand || '',
        type: item.type || '',
        size: item.size || '',
      }));
    }

    const enrichedData = parseResilientJson(generatedText);
    if (!enrichedData || enrichedData.length === 0) {
      return items.map(item => ({
        ...item,
        brand: item.brand || '',
        type: item.type || '',
        size: item.size || '',
      }));
    }

    return items.map((item, idx) => {
      const enrichment = enrichedData.find(e => e.index === idx + 1);
      if (enrichment) {
        const rawType = (enrichment.type || '').trim();
        const rawBrand = (enrichment.brand || item.brand || '').trim();

        const matchedType = categoriesList.find(
          c => c.toLowerCase() === rawType.toLowerCase()
        ) || item.type || (language === 'tr' ? 'Diğer' : 'Other');

        return {
          ...item,
          brand: trTitleCase(rawBrand),
          type: matchedType,
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
    console.error('Failed to parse Gemini response:', error);
    return items.map(item => ({
      ...item,
      brand: item.brand || '',
      type: item.type || '',
      size: item.size || '',
    }));
  }
});
