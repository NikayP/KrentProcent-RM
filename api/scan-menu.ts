import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

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

export const maxDuration = 60;

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { imageBase64, mimeType = 'image/jpeg', textInput } = req.body || {};

    if (!imageBase64 && !textInput) {
      return res.status(400).json({ error: 'Please provide an image or menu text.' });
    }

    const userSpecifiedBar = (req.body?.barName || '').trim();
    const scanStartTime = Date.now();

    // Fast path: if only textInput is provided (no image), parse locally in <2ms!
    if (!imageBase64 && textInput) {
      const fastLocal = parseMenuFallback(textInput, userSpecifiedBar);
      if (fastLocal.drinks && fastLocal.drinks.length > 0) {
        return res.status(200).json({
          detectedBarName: fastLocal.detectedBarName,
          drinks: fastLocal.drinks,
          durationMs: Date.now() - scanStartTime,
          modelUsed: 'local-instant-parser',
        });
      }
    }

    if (!aiClient) {
      if (imageBase64 && !textInput) {
        return res.status(400).json({
          error:
            'Image scanning requires GEMINI_API_KEY to be set in Vercel Environment Variables. Please set GEMINI_API_KEY or switch to the "Paste Menu Text" tab.',
        });
      }
      const parsedResult = parseMenuFallback(textInput || '', userSpecifiedBar);
      return res.status(200).json({
        detectedBarName: parsedResult.detectedBarName,
        drinks: parsedResult.drinks,
        note: 'Scanned via local heuristic parser (Gemini API key not configured).',
      });
    }

    // Ultra-compact prompt: eliminates ~80% of output tokens and JSON formatting overhead
    const promptText = `Extract all alcoholic drinks from this menu. Ignore UI frames/buttons.
${
  userSpecifiedBar
    ? ''
    : 'First line if venue name is visible: BAR|Venue Name\n'
}Output ONLY pipe-separated lines (NO JSON, NO markdown, NO headers, NO extra text):
Name|Cat|VolumeMl|ABV|Price
Cat codes: b=beer, w=wine, s=spirit, c=cocktail, ci=cider, o=other
Defaults if not printed: vaasje=250, fluitje=200, bottle/speciaalbier=330, weizen/pint=500, wine=150, shot=35, pilsabv=5.0.
Example:
Brand Pilsener|b|250|5.0|3.60
Duvel|b|330|8.5|4.80`;

    const contents: any[] = [];
    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '');
      contents.push({
        inlineData: {
          mimeType: mimeType,
          data: cleanBase64,
        },
      });
    }

    contents.push({
      text: promptText + (textInput ? `\n\nMenu:\n${textInput}` : ''),
    });

    // Prioritized fast vision models with thinking disabled (0ms reasoning overhead)
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
        const modelStart = Date.now();
        console.log(`[scan-menu] Attempting fast analysis with model: ${modelName}`);
        const isLiteModel = modelName.includes('lite');
        const response = await aiClient.models.generateContent({
          model: modelName,
          contents: contents.length === 1 ? contents[0] : { parts: contents },
          config: isLiteModel
            ? { temperature: 0 }
            : {
                temperature: 0,
                thinkingConfig: {
                  thinkingBudget: 0,
                },
              },
        });

        const rawText = response.text || '';
        if (rawText.trim().length > 0) {
          const parsedResult = parseVisionResponse(rawText, userSpecifiedBar);
          if (parsedResult.drinks && parsedResult.drinks.length > 0) {
            extractedDrinks = parsedResult.drinks;
            detectedBar = userSpecifiedBar || parsedResult.detectedBarName || detectedBar;
            successfulModel = modelName;
            console.log(
              `[scan-menu] Success with ${modelName} in ${Date.now() - modelStart}ms! Extracted ${extractedDrinks.length} drinks.`
            );
            break;
          }
        }
      } catch (err: any) {
        console.warn(`[scan-menu] Model ${modelName} failed (${err.message?.slice(0, 100)}), falling back...`);
        lastError = err;
      }
    }

    if (extractedDrinks.length > 0) {
      const finalBarName = userSpecifiedBar || detectedBar || 'Current Bar';
      return res.status(200).json({
        detectedBarName: finalBarName,
        drinks: extractedDrinks.map((d: any) => ({
          ...d,
          barName: finalBarName,
        })),
        modelUsed: successfulModel,
        durationMs: Date.now() - scanStartTime,
      });
    }

    // If AI calls failed or returned 0 drinks, and text was provided, use fallback text parser
    if (textInput) {
      const fallback = parseMenuFallback(textInput, userSpecifiedBar);
      return res.status(200).json({
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
    if (req.body?.textInput) {
      const userSpecifiedBar = (req.body?.barName || '').trim();
      const fallback = parseMenuFallback(req.body.textInput, userSpecifiedBar);
      return res.status(200).json({
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
}

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

  // 2. Line-by-line parsing (for compact pipe-delimited or list outputs)
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const items: any[] = [];
  let detectedBarFromHeader = finalBar;

  for (const line of lines) {
    if (
      line.startsWith('#') ||
      line.startsWith('---') ||
      line.startsWith('===') ||
      line.startsWith('```') ||
      line.toLowerCase().includes('failed to analyze') ||
      line.toLowerCase().includes('geschiedenis van')
    ) {
      continue;
    }

    if (line.includes('|')) {
      const parts = line.split('|').map((p) => p.trim());
      if (parts.length >= 2) {
        const rawFirst = parts[0].replace(/^[*•-]\s*/, '').replace(/[*_]/g, '').trim();

        // Check for optional BAR|Venue Name header line
        if (rawFirst.toUpperCase() === 'BAR' && parts[1]) {
          if (!userSpecifiedBar) {
            detectedBarFromHeader = parts[1].trim() || finalBar;
          }
          continue;
        }

        const name = rawFirst;
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
          const c = parts[1].toLowerCase().trim();
          if (c === 'w' || c.includes('wine') || c.includes('wijn')) category = 'wine';
          else if (c === 'ci' || c.includes('cider')) category = 'cider';
          else if (c === 's' || c.includes('spirit') || c.includes('shot') || c.includes('sterk')) category = 'spirit';
          else if (c === 'c' || c.includes('cocktail')) category = 'cocktail';
          else if (c === 'o' || c.includes('other')) category = 'other';
          else category = 'beer';
        }

        let volumeMl = 330;
        let abv = 5.0;
        let price = 0;
        let notes = '';

        // Fast positional parsing for compact format: Name|Cat|VolumeMl|ABV|Price(|Notes)
        if (parts.length >= 5) {
          const vRaw = parseFloat(parts[2].replace(',', '.').replace(/[^\d.]/g, ''));
          if (Number.isFinite(vRaw) && vRaw > 0) {
            volumeMl = /\bcl\b/i.test(parts[2]) && vRaw < 100 ? Math.round(vRaw * 10) : Math.round(vRaw);
          }
          const aRaw = parseFloat(parts[3].replace(',', '.').replace(/[^\d.]/g, ''));
          if (Number.isFinite(aRaw) && aRaw > 0 && aRaw <= 100) {
            abv = aRaw;
          }
          const pRaw = parseFloat(parts[4].replace(',', '.').replace(/[^\d.]/g, ''));
          if (Number.isFinite(pRaw) && pRaw > 0) {
            price = pRaw;
          }
          if (parts[5]) {
            notes = parts[5].trim();
          }
        } else {
          // Fallback column scanning when fewer than 5 columns
          notes = parts.length > 5 ? parts[parts.length - 1] : '';
          for (let i = 2; i < parts.length; i++) {
            const part = parts[i];
            if (/ml\b/i.test(part) || (/^\d{2,4}$/.test(part) && parseInt(part, 10) >= 100)) {
              const v = parseFloat(part.replace(/[^\d.]/g, ''));
              if (v > 0) volumeMl = v;
            } else if (/%/.test(part)) {
              const a = parseFloat(part.replace(',', '.').replace(/[^\d.]/g, ''));
              if (a > 0 && a <= 100) abv = a;
            } else if (/(?:€|\$|£)?\s*(\d+[.,]\d{1,2})/.test(part)) {
              const m = part.match(/(\d+[.,]\d{1,2})/);
              if (m) price = parseFloat(m[1].replace(',', '.'));
            }
          }
        }

        if (!price) {
          const pm = line.match(/(?:€|\$|£)?\s*(\d+[.,]\d{1,2})\s*$/);
          if (pm) price = parseFloat(pm[1].replace(',', '.'));
        }

        if (name && price > 0) {
          items.push({
            name,
            barName: detectedBarFromHeader,
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

    // Heuristic line parsing fallback
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
          barName: detectedBarFromHeader,
          category: 'beer',
          volumeMl: 330,
          abv,
          price,
          notes: '',
        });
      }
    }
  }

  return {
    detectedBarName: detectedBarFromHeader,
    drinks: items,
  };
}

function parseMenuFallback(text: string, userSpecifiedBar?: string) {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const items: any[] = [];
  let detectedHeaderBar = '';

  for (const line of lines) {
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
