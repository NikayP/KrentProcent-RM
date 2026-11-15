import {
  type DrinkCategory,
  sanitizeDrinkItem,
  isExplicitZeroAlcohol,
  normalizeCafePrice,
} from './calculator.ts';

export interface ParsedMenuDrink {
  name: string;
  barName: string;
  category: DrinkCategory;
  volumeMl: number;
  abv: number;
  price: number;
  notes: string;
}

export interface ParsedMenuResult {
  detectedBarName: string;
  drinks: ParsedMenuDrink[];
}

const DEFAULT_ABV_BY_CATEGORY: Record<string, number> = {
  beer: 5.0,
  wine: 12.5,
  spirit: 38.0,
  cocktail: 10.0,
  cider: 4.5,
};

const DEFAULT_VOL_BY_CATEGORY: Record<string, number> = {
  beer: 330,
  wine: 150,
  spirit: 35,
  cocktail: 200,
  cider: 330,
};

/**
 * Heuristic text menu parser used both client-side (offline/instant)
 * and server-side as a fallback when no Vision AI result is needed.
 */
export function parseMenuFallback(text: string, userSpecifiedBar?: string): ParsedMenuResult {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const items: ParsedMenuDrink[] = [];
  let detectedHeaderBar = '';
  const trimmedUserBar = (userSpecifiedBar || '').trim();

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
      const rawPrice = parseFloat(priceMatch[1].replace(',', '.'));
      if (!Number.isFinite(rawPrice) || rawPrice <= 0) continue;
      const price = normalizeCafePrice(rawPrice) || rawPrice;

      const lowerLine = line.toLowerCase();
      let category: DrinkCategory = 'beer';
      if (
        /\b(wine|wijn|huiswijn|chardonnay|merlot|cabernet|sauvignon|pinot|rosé|rose|prosecco|cava|champagne)\b/i.test(
          lowerLine
        )
      ) {
        category = 'wine';
      } else if (
        /\b(cocktail|gin\s*&\s*tonic|mojito|martini|margarita|spritz|negroni|mule|daiquiri)\b/i.test(
          lowerLine
        )
      ) {
        category = 'cocktail';
      } else if (
        /\b(shot|tequila|vodka|jagermeister|jägermeister|whisky|whiskey|bourbon|rum|jenever|limoncello|sambuca)\b/i.test(
          lowerLine
        )
      ) {
        category = 'spirit';
      } else if (/\b(cider|apple bandit|magners|strongbow)\b/i.test(lowerLine)) {
        category = 'cider';
      }

      const abv = isExplicitZeroAlcohol(line)
        ? 0
        : abvMatch
          ? parseFloat(abvMatch[1].replace(',', '.'))
          : DEFAULT_ABV_BY_CATEGORY[category] ?? 5.0;

      let volumeMl = DEFAULT_VOL_BY_CATEGORY[category] ?? 330;

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

      const finalBar = trimmedUserBar || detectedHeaderBar || 'De Bruine Kroeg';
      const sanitized = sanitizeDrinkItem({
        name,
        barName: finalBar,
        category,
        volumeMl,
        abv,
        price,
        notes: 'Parsed from text',
      });

      items.push({
        name: sanitized.name,
        barName: finalBar,
        category: sanitized.category,
        volumeMl: sanitized.volumeMl,
        abv: sanitized.abv,
        price: sanitized.price,
        notes: sanitized.notes || 'Parsed from text',
      });
    }
  }

  const resolvedBar = trimmedUserBar || detectedHeaderBar || 'De Bruine Kroeg';
  return {
    detectedBarName: resolvedBar,
    drinks: items.map((item) => ({ ...item, barName: resolvedBar })),
  };
}
