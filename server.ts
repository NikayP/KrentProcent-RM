import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Body parsing with generous limit for menu screenshots / camera uploads
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Initialize Google GenAI client if key is present
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (apiKey) {
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Menu scanning API endpoint
app.post('/api/scan-menu', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', textInput } = req.body;

    if (!imageBase64 && !textInput) {
      return res.status(400).json({ error: 'Please provide an image or menu text.' });
    }

    const userSpecifiedBar = (req.body.barName || '').trim();

    if (!aiClient) {
      // Graceful fallback parser when GEMINI_API_KEY is not configured
      const parsedResult = parseMenuFallback(textInput || '', userSpecifiedBar);
      return res.json({
        detectedBarName: parsedResult.detectedBarName,
        drinks: parsedResult.drinks,
        note: 'Scanned via local heuristic parser (Gemini API key not configured).',
      });
    }

    const promptText = `You are an expert drinks menu reader for a bar alcohol comparison app called "KrentProcent RM".
Analyze the provided image or text of a bar drinks menu (primarily focused on beers, but also include wines, spirits, cocktails, and ciders).
${
  userSpecifiedBar
    ? `CRITICAL INSTRUCTION: The user is currently sitting at "${userSpecifiedBar}". You MUST use "${userSpecifiedBar}" as the "barName" for ALL drinks and "detectedBarName". Do NOT alter spelling, accents, or invent a new bar name.`
    : `Identify the Bar/Venue name if present in the header, logo, or text (e.g. "De Bruine Kroeg", "Gollem", "The Waterhole"). If not specified or detected, use "Current Bar".`
}

Extract each distinct drink item with its:
1. "name": Brand or drink name (e.g. "Heineken Vaasje", "Duvel", "La Chouffe", "Guinness Pint", "House Chardonnay", "Espresso Martini")
2. "barName": The venue name ("${userSpecifiedBar || 'Current Bar'}").
3. "category": One of "beer", "wine", "spirit", "cocktail", "cider", "other"
4. "volumeMl": Volume in milliliters as a number.
   - If stated in cl, multiply by 10 (e.g. 25cl = 250, 33cl = 330, 50cl = 500).
   - If stated as pint/pintje: UK pint is ~568ml, standard pub pint or halve liter is 500ml, standard Dutch vaasje is 250ml, fluitje is 200ml.
   - If standard beer bottle/can with unspecified volume, assume 330ml.
   - If standard wine glass with unspecified volume, assume 150ml (bottle is 750ml).
   - If shot/spirit with unspecified volume, assume 35ml.
   - If cocktail with unspecified volume, assume 200ml.
5. "abv": Alcohol by volume percentage as a number (e.g., 5.0 for 5%, 8.5 for 8.5%). If missing for a well-known drink, estimate accurately (e.g. standard pilsner 5.0%, wine 12.5%, shot 40.0%).
6. "price": The price as a number in the local currency (e.g. 3.50, 4.20, 6.00). If multiple sizes exist, output a separate item for each size.
7. "notes": Brief extra info like "Draft", "Bottle", "Draft 50cl", etc.

Ignore non-alcoholic drinks (soda, water, 0.0% beers, coffee, snacks) unless specifically requested.
Return structured JSON only.`;

    const contents: any[] = [];
    if (imageBase64) {
      // Clean data URI prefix if present
      const cleanBase64 = imageBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '');
      contents.push({
        inlineData: {
          mimeType: mimeType,
          data: cleanBase64,
        },
      });
    }

    contents.push({
      text: promptText + (textInput ? `\n\nRaw Menu Text:\n${textInput}` : ''),
    });

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contents.length === 1 ? contents[0] : { parts: contents },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedBarName: { type: Type.STRING },
            drinks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  barName: { type: Type.STRING },
                  category: {
                    type: Type.STRING,
                    description: 'One of: beer, wine, spirit, cocktail, cider, other',
                  },
                  volumeMl: { type: Type.NUMBER },
                  abv: { type: Type.NUMBER },
                  price: { type: Type.NUMBER },
                  notes: { type: Type.STRING },
                },
                required: ['name', 'category', 'volumeMl', 'abv', 'price'],
              },
            },
          },
          required: ['drinks'],
        },
      },
    });

    const rawResponse = response.text || '{}';
    const parsed = JSON.parse(rawResponse);

    // Guarantee that if user specified a bar name, it strictly overrides any AI variation
    const finalBarName = userSpecifiedBar || parsed.detectedBarName || 'Current Bar';
    if (parsed.drinks && Array.isArray(parsed.drinks)) {
      parsed.drinks = parsed.drinks.map((d: any) => ({
        ...d,
        barName: userSpecifiedBar || d.barName || finalBarName,
      }));
    }
    parsed.detectedBarName = finalBarName;

    return res.json(parsed);
  } catch (error: any) {
    console.error('Error scanning menu:', error);
    // If Gemini fails, fallback to heuristic or clear error
    if (req.body.textInput) {
      const userSpecifiedBar = (req.body.barName || '').trim();
      const fallback = parseMenuFallback(req.body.textInput, userSpecifiedBar);
      return res.json({
        detectedBarName: fallback.detectedBarName,
        drinks: fallback.drinks,
        warning: 'AI parsing encountered an issue, used local fallback.',
      });
    }
    return res.status(500).json({
      error: 'Failed to analyze menu image. Please verify the image is clear or try entering text.',
      details: error.message,
    });
  }
});

// Heuristic fallback text parser when AI is unavailable or text is supplied
function parseMenuFallback(text: string, userSpecifiedBar?: string) {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const items: any[] = [];
  let detectedHeaderBar = '';

  for (const line of lines) {
    // Check if line looks like a menu header e.g. "--- DE BRUINE KROEG BEER & DRINKS MENU ---"
    if (/^[-=*#]+.*[-=*#]+$/.test(line) && !/\d+[.,]\d{2}/.test(line)) {
      const cleanedHeader = line
        .replace(/[-=*#]/g, '')
        .replace(/\b(beer|drinks|dranken|menu|kaart|bar|&)\b/gi, '')
        .trim();
      if (cleanedHeader.length >= 3) {
        detectedHeaderBar = cleanedHeader
          .toLowerCase()
          .replace(/\b\w/g, (c) => c.toUpperCase());
      }
      continue;
    }

    // Match price at the end or with currency symbol e.g. €4.50 or 4,50 or 4.50
    const priceMatch =
      line.match(/(?:€|\$|£|CHF|kr)\s*(\d+[.,]\d{1,2})\b/i) ||
      line.match(/\b(\d+[.,]\d{2})\s*(?:€|\$|£|CHF|kr)?\s*$/i) ||
      line.match(/[-–—]\s*(?:€|\$|£)?\s*(\d+(?:[.,]\d{1,2})?)\s*$/);

    const abvMatch = line.match(/(\d+(?:[.,]\d+)?)\s*%/);
    const volumeMatch = line.match(/\b(\d+(?:[.,]\d+)?)\s*(ml|cl|l|liter|pint)\b/i);

    if (priceMatch) {
      const price = parseFloat(priceMatch[1].replace(',', '.'));
      if (!Number.isFinite(price) || price <= 0) continue;

      const lowerLine = line.toLowerCase();
      let category = 'beer';
      if (/\b(wine|wijn|huiswijn|chardonnay|merlot|cabernet|sauvignon|pinot|rosé|rose|prosecco|cava|champagne)\b/i.test(lowerLine)) {
        category = 'wine';
      } else if (/\b(cocktail|gin\s*&\s*tonic|mojito|martini|margarita|spritz|negroni|mule|daiquiri)\b/i.test(lowerLine)) {
        category = 'cocktail';
      } else if (/\b(shot|tequila|vodka|jagermeister|jägermeister|whisky|whiskey|bourbon|rum|jenever|limoncello|sambuca)\b/i.test(lowerLine)) {
        category = 'spirit';
      } else if (/\b(cider|apple bandit|magners|strongbow)\b/i.test(lowerLine)) {
        category = 'cider';
      }

      const defaultAbvByCategory: Record<string, number> = {
        beer: 5.0,
        wine: 12.5,
        spirit: 38.0,
        cocktail: 10.0,
        cider: 4.5,
      };
      const abv = abvMatch
        ? parseFloat(abvMatch[1].replace(',', '.'))
        : defaultAbvByCategory[category] ?? 5.0;

      // Skip 0.0% non-alcoholic items
      if (abv <= 0) continue;

      const defaultVolByCategory: Record<string, number> = {
        beer: 330,
        wine: 150,
        spirit: 35,
        cocktail: 200,
        cider: 330,
      };
      let volumeMl = defaultVolByCategory[category] ?? 330;

      if (volumeMatch) {
        const val = parseFloat(volumeMatch[1].replace(',', '.'));
        const unit = volumeMatch[2].toLowerCase();
        if (unit === 'cl') volumeMl = Math.round(val * 10);
        else if (unit === 'l' || unit === 'liter') volumeMl = Math.round(val * 1000);
        else if (unit === 'pint') volumeMl = 500;
        else volumeMl = Math.round(val);
      } else if (/\bpitcher\b/i.test(lowerLine)) {
        volumeMl = 1500;
      } else if (/\b(fles|bottle)\b/i.test(lowerLine) && category === 'wine') {
        volumeMl = 750;
      } else if (/\b(pint|halve liter)\b/i.test(lowerLine)) {
        volumeMl = 500;
      } else if (/\bvaasje\b/i.test(lowerLine)) {
        volumeMl = 250;
      } else if (/\bfluitje\b/i.test(lowerLine)) {
        volumeMl = 200;
      }

      // Clean name
      let name = line
        .replace(priceMatch[0], '')
        .replace(/\(\s*\d+(?:[.,]\d+)?\s*%\s*\)/g, '')
        .replace(/\d+(?:[.,]\d+)?\s*%/g, '')
        .replace(/\(\s*\d+(?:[.,]\d+)?\s*(ml|cl|l|liter|pint)\s*\)/gi, '')
        .replace(/\b\d+(?:[.,]\d+)?\s*(ml|cl|l|liter)\b/gi, '')
        .replace(/(?:€|\$|£|CHF|kr)/gi, '')
        .replace(/[-–—]+/g, ' ')
        .replace(/\(\s*\)/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!name) name = 'Drink Item';

      const finalBar = userSpecifiedBar || detectedHeaderBar || 'De Bruine Kroeg';

      items.push({
        name,
        barName: finalBar,
        category,
        volumeMl,
        abv,
        price,
        notes: 'Parsed from text',
      });
    }
  }

  const resolvedBar = userSpecifiedBar || detectedHeaderBar || 'De Bruine Kroeg';
  return {
    detectedBarName: resolvedBar,
    drinks: items.map((item) => ({ ...item, barName: resolvedBar })),
  };
}

// Dev server vs Production setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`KrentProcent RM server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
