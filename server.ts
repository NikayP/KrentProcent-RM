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

// Config status endpoint
app.get('/api/config', (_req, res) => {
  res.json({
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()),
  });
});

// Menu scanning API endpoint
app.post('/api/scan-menu', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', textInput } = req.body;

    if (!imageBase64 && !textInput) {
      return res.status(400).json({ error: 'Please provide an image or menu text.' });
    }

    const userSpecifiedBar = (req.body.barName || '').trim();

    if (!aiClient) {
      if (imageBase64 && !textInput) {
        return res.status(400).json({
          error:
            'Image scanning requires a GEMINI_API_KEY in .env. Please configure GEMINI_API_KEY or switch to the "Paste Menu Text" tab.',
        });
      }
      // Graceful fallback parser when GEMINI_API_KEY is not configured
      const parsedResult = parseMenuFallback(textInput || '', userSpecifiedBar);
      return res.json({
        detectedBarName: parsedResult.detectedBarName,
        drinks: parsedResult.drinks,
        note: 'Scanned via local heuristic parser (Gemini API key not configured).',
      });
    }

    const promptText = `You are an expert drinks menu reader for a bar alcohol comparison app called "KrentProcent RM".
${
  userSpecifiedBar
    ? `The user is currently sitting at "${userSpecifiedBar}". You MUST use "${userSpecifiedBar}" as the barName.`
    : `Identify the Bar/Venue name if present in the header, logo, or text (e.g. "Café de Opera", "De Bruine Kroeg", "Gollem"). If not specified or detected, use "Current Bar".`
}

CRITICAL VISION INSTRUCTION:
- If the image shows a menu card inside a screen or interface, focus EXCLUSIVELY on the actual drinks menu card and ignore any website frames, buttons, or error boxes.
- Extract every distinct alcoholic drink visible on the menu (beers, wines, spirits, cocktails, ciders).
- For each item, capture:
  * name: Drink or brand name (e.g. "Duvel", "Heineken Vaasje", "Westmalle Tripel", "Lagunitas IPA")
  * category: "beer" | "wine" | "spirit" | "cocktail" | "cider" | "other"
  * volumeMl: serving volume in ml (e.g. 200 for fluitje, 250 for vaasje, 330 for bottle, 500 for pint/halve liter, 1500 for pitcher, 150 for wine, 35 for shot)
  * abv: percentage number (e.g. 5.0 for 5%, 8.5 for 8.5%)
  * price: price number (e.g. 3.50, 4.80, 5.75)
  * notes: brief style or notes (e.g. "Blond", "Wisseltap", "Trappist", "Draft")

Format your response as either valid JSON:
{
  "detectedBarName": "${userSpecifiedBar || 'Current Bar'}",
  "drinks": [
    { "name": "Duvel", "category": "beer", "volumeMl": 330, "abv": 8.5, "price": 4.80, "notes": "Blond" }
  ]
}
OR one item per line:
Name | Category | VolumeMl | ABV% | Price | Notes`;

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

    // Multi-model vision fallback chain to overcome temporary 503 high demand spikes
    const CANDIDATE_MODELS = [
      'gemini-3.5-flash',
      'gemini-3.6-flash',
      'gemini-flash-lite-latest',
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-flash-latest',
    ];

    let extractedDrinks: any[] = [];
    let detectedBar = userSpecifiedBar || 'Current Bar';
    let lastError: any = null;
    let successfulModel = '';

    for (const modelName of CANDIDATE_MODELS) {
      try {
        console.log(`[scan-menu] Attempting analysis with model: ${modelName}`);
        const response = await aiClient.models.generateContent({
          model: modelName,
          contents: contents.length === 1 ? contents[0] : { parts: contents },
        });

        const rawText = response.text || '';
        if (rawText.trim().length > 0) {
          const parsedResult = parseVisionResponse(rawText, userSpecifiedBar);
          if (parsedResult.drinks && parsedResult.drinks.length > 0) {
            extractedDrinks = parsedResult.drinks;
            detectedBar = userSpecifiedBar || parsedResult.detectedBarName || detectedBar;
            successfulModel = modelName;
            console.log(
              `[scan-menu] Success with ${modelName}! Extracted ${extractedDrinks.length} drinks.`
            );
            break;
          } else {
            console.log(`[scan-menu] Model ${modelName} returned text but 0 parsed drinks, trying next...`);
          }
        }
      } catch (err: any) {
        console.warn(`[scan-menu] Model ${modelName} failed (${err.message?.slice(0, 100)}), falling back...`);
        lastError = err;
      }
    }

    if (extractedDrinks.length > 0) {
      const finalBarName = userSpecifiedBar || detectedBar || 'Current Bar';
      return res.json({
        detectedBarName: finalBarName,
        drinks: extractedDrinks.map((d: any) => ({
          ...d,
          barName: finalBarName,
        })),
        modelUsed: successfulModel,
      });
    }

    // If AI calls failed or returned 0 drinks, and text was provided, use fallback text parser
    if (textInput) {
      const fallback = parseMenuFallback(textInput, userSpecifiedBar);
      return res.json({
        detectedBarName: fallback.detectedBarName,
        drinks: fallback.drinks,
        warning: 'AI parsing encountered an issue, used local text parser.',
      });
    }

    // If no drinks found
    return res.status(500).json({
      error:
        'Could not detect any alcoholic drinks from the menu image. Please ensure the menu photo is in focus or try entering text on the "Paste Menu Text" tab.',
      details: lastError ? lastError.message : 'No drinks recognized',
    });
  } catch (error: any) {
    console.error('Error scanning menu:', error);
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

// Robust dual-format parser: handles JSON or line-by-line pipe/bullet output from Vision models
function parseVisionResponse(rawText: string, userSpecifiedBar?: string) {
  const finalBar = userSpecifiedBar || 'Current Bar';

  // 1. Try JSON extraction first
  try {
    const jsonMatch =
      rawText.match(/```json\s*([\s\S]*?)\s*```/i) ||
      rawText.match(/```\s*([\s\S]*?)\s*```/i) ||
      rawText.match(/(\{[\s\S]*\})/);

    const jsonString = jsonMatch ? jsonMatch[1] : rawText;
    const parsed = JSON.parse(jsonString);
    const list = Array.isArray(parsed) ? parsed : parsed.drinks || parsed.items;

    if (Array.isArray(list) && list.length > 0) {
      const validDrinks = list
        .filter((d) => d && (d.name || d.drinkName))
        .map((d) => ({
          name: (d.name || d.drinkName || 'Drink').trim(),
          barName: userSpecifiedBar || d.barName || parsed.detectedBarName || finalBar,
          category: (d.category || 'beer').toLowerCase(),
          volumeMl: Number(d.volumeMl) || 330,
          abv: Number(d.abv) || 5.0,
          price: Number(d.price) || 4.5,
          notes: d.notes || '',
        }))
        .filter((d) => d.price > 0 && d.volumeMl > 0);

      if (validDrinks.length > 0) {
        return {
          detectedBarName: userSpecifiedBar || parsed.detectedBarName || finalBar,
          drinks: validDrinks,
        };
      }
    }
  } catch (e) {
    // Continue to line parsing
  }

  // 2. Line-by-line parsing (for pipe-delimited or list outputs)
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const items: any[] = [];

  for (const line of lines) {
    if (
      line.startsWith('#') ||
      line.startsWith('---') ||
      line.startsWith('===') ||
      line.toLowerCase().includes('failed to analyze') ||
      line.toLowerCase().includes('geschiedenis van')
    ) {
      continue;
    }

    if (line.includes('|')) {
      const parts = line.split('|').map((p) => p.trim());
      if (parts.length >= 2) {
        const name = parts[0].replace(/^[*•-]\s*/, '').replace(/[*_]/g, '').trim();
        if (
          !name ||
          name.toLowerCase() === 'name' ||
          name.toLowerCase() === 'drink name' ||
          name.toLowerCase().includes('tapbieren wisseltaps')
        ) {
          continue;
        }

        let category = 'beer';
        if (parts[1]) {
          const c = parts[1].toLowerCase();
          if (c.includes('wine') || c.includes('wijn')) category = 'wine';
          else if (c.includes('cider')) category = 'cider';
          else if (c.includes('spirit') || c.includes('shot')) category = 'spirit';
          else if (c.includes('cocktail')) category = 'cocktail';
        }

        let volumeMl = 330;
        let abv = 5.0;
        let price = 0;
        let notes = parts[parts.length - 1] || '';

        for (let i = 2; i < parts.length; i++) {
          const part = parts[i];
          if (/ml\b/i.test(part) || (/^\d{2,4}$/.test(part) && parseInt(part, 10) >= 100)) {
            const v = parseFloat(part.replace(/[^\d.]/g, ''));
            if (v > 0) volumeMl = v;
          } else if (
            /%/.test(part) ||
            (/^\d+(?:[.,]\d+)?$/.test(part) && parseFloat(part.replace(',', '.')) <= 25 && !price)
          ) {
            const a = parseFloat(part.replace(',', '.').replace(/[^\d.]/g, ''));
            if (a > 0 && a <= 100) abv = a;
          } else if (/(?:€|\$|£)?\s*(\d+[.,]\d{1,2})/.test(part)) {
            const m = part.match(/(\d+[.,]\d{1,2})/);
            if (m) price = parseFloat(m[1].replace(',', '.'));
          }
        }

        if (!price) {
          const pm = line.match(/(?:€|\$|£)?\s*(\d+[.,]\d{2})\b/);
          if (pm) price = parseFloat(pm[1].replace(',', '.'));
        }

        if (name && price > 0) {
          items.push({
            name,
            barName: finalBar,
            category,
            volumeMl,
            abv,
            price,
            notes,
          });
          continue;
        }
      }
    }

    // Heuristic line parsing
    const priceMatch =
      line.match(/(?:€|\$|£)?\s*(\d+[.,]\d{2})\b/) || line.match(/\(\s*(\d+[.,]\d{1,2})\s*\)/);
    if (priceMatch) {
      const price = parseFloat(priceMatch[1].replace(',', '.'));
      const abvMatch = line.match(/(\d+(?:[.,]\d+)?)\s*%/);
      const abv = abvMatch ? parseFloat(abvMatch[1].replace(',', '.')) : 5.0;

      const name = line
        .replace(/[*_#•-]/g, ' ')
        .replace(priceMatch[0], '')
        .replace(/\(\s*\d+(?:[.,]\d+)?\s*%\s*\)/g, '')
        .replace(/[-–—|()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (name && name.length >= 2 && price > 0 && price < 100) {
        items.push({
          name,
          barName: finalBar,
          category: 'beer',
          volumeMl: 330,
          abv,
          price,
          notes: 'Scanned from menu',
        });
      }
    }
  }

  return {
    detectedBarName: finalBar,
    drinks: items,
  };
}

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
