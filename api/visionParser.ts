import {
  sanitizeDrinkItem,
  isExplicitZeroAlcohol,
  normalizeCafePrice,
} from '../src/utils/calculator.ts';

/**
 * Robust dual-format parser: handles JSON or line-by-line pipe/bullet output from Vision models.
 */
export function parseVisionResponse(rawText: string, userSpecifiedBar?: string) {
  const finalBar = userSpecifiedBar || 'Current Bar';

  const postProcessItem = (rawItem: {
    name: string;
    barName: string;
    category: string;
    volumeMl: number;
    abv: number;
    price: number;
    notes?: string;
  }) => {
    const snappedPrice = normalizeCafePrice(rawItem.price);
    const sanitized = sanitizeDrinkItem({
      name: rawItem.name,
      barName: rawItem.barName,
      category: rawItem.category as any,
      volumeMl: rawItem.volumeMl,
      abv: isExplicitZeroAlcohol(rawItem.name) ? 0 : rawItem.abv,
      price: snappedPrice > 0 ? snappedPrice : rawItem.price,
      notes: rawItem.notes,
    });
    return {
      name: sanitized.name,
      barName: sanitized.barName || finalBar,
      category: sanitized.category,
      volumeMl: sanitized.volumeMl,
      abv: sanitized.abv,
      price: sanitized.price,
      notes: sanitized.notes || '',
    };
  };

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
        .map((d) => {
          const rawName = (d.name || d.drinkName || 'Drink').trim();
          const parsedAbv = Number(d.abv);
          return postProcessItem({
            name: rawName,
            barName: userSpecifiedBar || d.barName || parsed.detectedBarName || finalBar,
            category: (d.category || 'beer').toLowerCase(),
            volumeMl: Number(d.volumeMl) || 330,
            abv: isExplicitZeroAlcohol(rawName)
              ? 0
              : Number.isFinite(parsedAbv) && parsedAbv >= 0
                ? parsedAbv
                : 5.0,
            price: Number(d.price) || 4.5,
            notes: d.notes || '',
          });
        })
        .filter((d) => d.price > 0 && d.volumeMl > 0);

      if (validDrinks.length > 0) {
        return {
          detectedBarName: userSpecifiedBar || parsed.detectedBarName || finalBar,
          drinks: validDrinks,
        };
      }
    }
  } catch {
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
        let abv = isExplicitZeroAlcohol(name) ? 0 : 5.0;
        let price = 0;
        let notes = '';

        // Fast positional parsing for compact format: Name|Cat|VolumeMl|ABV|Price(|Notes)
        if (parts.length >= 5) {
          const vRaw = parseFloat(parts[2].replace(',', '.').replace(/[^\d.]/g, ''));
          if (Number.isFinite(vRaw) && vRaw > 0) {
            volumeMl = /\bcl\b/i.test(parts[2]) && vRaw < 100 ? Math.round(vRaw * 10) : Math.round(vRaw);
          }
          const aRaw = parseFloat(parts[3].replace(',', '.').replace(/[^\d.]/g, ''));
          if (Number.isFinite(aRaw) && aRaw >= 0 && aRaw <= 100) {
            abv = aRaw;
          }
          const pRaw = parseFloat(parts[4].replace(',', '.').replace(/[^\d.]/g, ''));
          if (Number.isFinite(pRaw) && pRaw > 0) {
            price = pRaw;
          }
          if (parts[5]) {
            notes = parts[5].trim();
          }
        } else if (parts.length === 4) {
          const secondAsNum = parseFloat(parts[1].replace(',', '.').replace(/[^\d.]/g, ''));
          if (Number.isFinite(secondAsNum) && secondAsNum >= 20) {
            category = 'beer';
            volumeMl = /\bcl\b/i.test(parts[1]) && secondAsNum < 100 ? Math.round(secondAsNum * 10) : Math.round(secondAsNum);
          }
          const aRaw = parseFloat(parts[2].replace(',', '.').replace(/[^\d.]/g, ''));
          if (Number.isFinite(aRaw) && aRaw >= 0 && aRaw <= 100) abv = aRaw;
          const pRaw = parseFloat(parts[3].replace(',', '.').replace(/[^\d.]/g, ''));
          if (Number.isFinite(pRaw) && pRaw > 0) price = pRaw;
        } else if (parts.length === 3) {
          category = 'beer';
          const aRaw = parseFloat(parts[1].replace(',', '.').replace(/[^\d.]/g, ''));
          if (Number.isFinite(aRaw) && aRaw >= 0 && aRaw <= 100) abv = aRaw;
          const pRaw = parseFloat(parts[2].replace(',', '.').replace(/[^\d.]/g, ''));
          if (Number.isFinite(pRaw) && pRaw > 0) price = pRaw;
        } else {
          notes = parts.length > 5 ? parts[parts.length - 1] : '';
          for (let i = 2; i < parts.length; i++) {
            const part = parts[i];
            if (/ml\b/i.test(part) || (/^\d{2,4}$/.test(part) && parseInt(part, 10) >= 100)) {
              const v = parseFloat(part.replace(/[^\d.]/g, ''));
              if (v > 0) volumeMl = v;
            } else if (/%/.test(part)) {
              const a = parseFloat(part.replace(',', '.').replace(/[^\d.]/g, ''));
              if (a >= 0 && a <= 100) abv = a;
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
          items.push(
            postProcessItem({
              name,
              barName: detectedBarFromHeader,
              category,
              volumeMl,
              abv,
              price,
              notes,
            })
          );
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
      const abv = isExplicitZeroAlcohol(line)
        ? 0
        : abvMatch
          ? parseFloat(abvMatch[1].replace(',', '.'))
          : 5.0;

      const name = line
        .replace(/[*_#•-]/g, ' ')
        .replace(priceMatch[0], '')
        .replace(/\(\s*\d+(?:[.,]\d+)?\s*%\s*\)/g, '')
        .replace(/[-–—|()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (name && name.length >= 2 && price > 0 && price < 100) {
        items.push(
          postProcessItem({
            name,
            barName: detectedBarFromHeader,
            category: 'beer',
            volumeMl: 330,
            abv,
            price,
            notes: '',
          })
        );
      }
    }
  }

  return {
    detectedBarName: detectedBarFromHeader,
    drinks: items,
  };
}
