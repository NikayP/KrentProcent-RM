export type DrinkCategory = 'beer' | 'wine' | 'spirit' | 'cocktail' | 'cider' | 'other';

export interface DrinkItem {
  id: string;
  name: string;
  category: DrinkCategory;
  volumeMl: number;
  abv: number; // percentage (e.g. 5.0 for 5%)
  price: number;
  barName?: string; // Venue / Bar Name (e.g. "Café Gollem", "De Zotte")
  notes?: string;
  isCustom?: boolean;
}

export interface CalculatedDrink extends DrinkItem {
  pureAlcoholMl: number; // in ml
  pureAlcoholPerCurrency: number; // ml of pure alcohol per 1 currency unit (the Krent Score)
  costPerStandardDrink: number; // currency cost per standard drink (12.5ml pure alcohol)
  standardDrinks: number; // number of standard drinks (12.5ml units) in this serving
  pricePerLiter: number; // price per 1000ml of liquid
  pricePer100mlPureAlcohol: number;
  efficiencyRank?: number;
  percentageRelativeToBest?: number; // 0% if best, or negative e.g. -24%
}

export interface BarSummary {
  barName: string;
  drinkCount: number;
  bestDrink: CalculatedDrink | null;
  worstDrink: CalculatedDrink | null;
  averageKrentScore: number;
  averageStandardDrinkCost: number;
  averagePricePerLiter: number;
  cheapestDrink: CalculatedDrink | null;
}

export type DuplicateMatchType = 'exact' | 'same_variant' | 'same_name_diff_volume';

export interface DuplicateCheckResult {
  matchType: DuplicateMatchType;
  existingDrink: DrinkItem;
  allSameNameInBar: DrinkItem[];
}

export interface CrossBarDrinkComparison {
  groupKey: string;
  displayName: string;
  category: DrinkCategory;
  volumeMl: number;
  abv: number;
  entries: CalculatedDrink[]; // sorted descending by Krent score (best deal first)
  bestEntry: CalculatedDrink;
  worstEntry: CalculatedDrink;
  maxPriceDifference: number;
  maxValueAdvantagePercent: number;
}

export const STANDARD_DRINK_ALCOHOL_ML = 12.5; // ~10 grams of pure alcohol (standard Dutch/EU unit)
export const DEFAULT_BAR_NAME = 'Current Bar';

const VALID_CATEGORIES: ReadonlySet<DrinkCategory> = new Set([
  'beer',
  'wine',
  'spirit',
  'cocktail',
  'cider',
  'other',
]);

/**
 * Sanitizes a numeric value, returning fallback if NaN, infinite, or below min.
 */
export function sanitizePositiveNumber(value: unknown, fallback = 0, max?: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  if (max !== undefined && num > max) return max;
  return num;
}

/**
 * Sanitizes a DrinkItem to guarantee valid properties and safe numbers.
 */
export function sanitizeDrinkItem(raw: Partial<DrinkItem> & { id?: string }): DrinkItem {
  const category: DrinkCategory =
    raw.category && VALID_CATEGORIES.has(raw.category) ? raw.category : 'beer';
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Unnamed Drink';
  const barName =
    typeof raw.barName === 'string' && raw.barName.trim() ? raw.barName.trim() : DEFAULT_BAR_NAME;
  const volumeMl = sanitizePositiveNumber(raw.volumeMl, 330, 50000);
  const abv = sanitizePositiveNumber(raw.abv, 0, 100);
  const price = sanitizePositiveNumber(raw.price, 0, 100000);

  return {
    id:
      typeof raw.id === 'string' && raw.id.trim()
        ? raw.id.trim()
        : `drink-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name,
    barName,
    category,
    volumeMl: Number(volumeMl.toFixed(1)),
    abv: Number(abv.toFixed(2)),
    price: Number(price.toFixed(2)),
    notes: typeof raw.notes === 'string' ? raw.notes.trim() : undefined,
    isCustom: Boolean(raw.isCustom),
  };
}

/**
 * Calculates pure alcohol in ml from volume (ml) and ABV (%).
 */
export function calculatePureAlcoholMl(volumeMl: number, abv: number): number {
  if (!Number.isFinite(volumeMl) || !Number.isFinite(abv) || volumeMl <= 0 || abv <= 0) {
    return 0;
  }
  const clampedAbv = Math.min(100, abv);
  return (volumeMl * clampedAbv) / 100;
}

/**
 * Calculates pure alcohol (ml) per unit of currency spent.
 * This is the primary KrentProcent efficiency score.
 * Higher number means more alcohol per euro/dollar.
 */
export function calculateAlcoholPerCurrency(pureAlcoholMl: number, price: number): number {
  if (!Number.isFinite(pureAlcoholMl) || !Number.isFinite(price) || price <= 0 || pureAlcoholMl <= 0) {
    return 0;
  }
  return pureAlcoholMl / price;
}

/**
 * Calculates cost for one standard drink (~12.5ml pure alcohol).
 */
export function calculateCostPerStandardDrink(
  pureAlcoholMl: number,
  price: number,
  standardUnitMl = STANDARD_DRINK_ALCOHOL_ML
): number {
  if (
    !Number.isFinite(pureAlcoholMl) ||
    !Number.isFinite(price) ||
    !Number.isFinite(standardUnitMl) ||
    pureAlcoholMl <= 0 ||
    price <= 0 ||
    standardUnitMl <= 0
  ) {
    return 0;
  }
  return (standardUnitMl / pureAlcoholMl) * price;
}

/**
 * Full calculation for a single drink item.
 */
export function calculateDrinkMetrics(drink: DrinkItem): CalculatedDrink {
  const safeVolume = Number.isFinite(drink.volumeMl) && drink.volumeMl > 0 ? drink.volumeMl : 0;
  const safeAbv = Number.isFinite(drink.abv) && drink.abv > 0 ? Math.min(100, drink.abv) : 0;
  const safePrice = Number.isFinite(drink.price) && drink.price > 0 ? drink.price : 0;

  const pureAlcoholMl = calculatePureAlcoholMl(safeVolume, safeAbv);
  const pureAlcoholPerCurrency = calculateAlcoholPerCurrency(pureAlcoholMl, safePrice);
  const costPerStandardDrink = calculateCostPerStandardDrink(pureAlcoholMl, safePrice);
  const standardDrinks = pureAlcoholMl > 0 ? pureAlcoholMl / STANDARD_DRINK_ALCOHOL_ML : 0;
  const pricePerLiter = safeVolume > 0 && safePrice > 0 ? (safePrice / safeVolume) * 1000 : 0;
  const pricePer100mlPureAlcohol =
    pureAlcoholMl > 0 && safePrice > 0 ? (safePrice / pureAlcoholMl) * 100 : 0;

  return {
    ...drink,
    barName: drink.barName?.trim() || DEFAULT_BAR_NAME,
    pureAlcoholMl: Number(pureAlcoholMl.toFixed(2)),
    pureAlcoholPerCurrency: Number(pureAlcoholPerCurrency.toFixed(3)),
    costPerStandardDrink: Number(costPerStandardDrink.toFixed(2)),
    standardDrinks: Number(standardDrinks.toFixed(2)),
    pricePerLiter: Number(pricePerLiter.toFixed(2)),
    pricePer100mlPureAlcohol: Number(pricePer100mlPureAlcohol.toFixed(2)),
  };
}

/**
 * Normalizes a bar name by stripping diacritics/accents, trimming, and collapsing whitespace.
 * e.g. "Café in de Blaauwe Hand" -> "cafe in de blaauwe hand"
 *      "Cafe   in de Blaauwe Hand" -> "cafe in de blaauwe hand"
 */
export function normalizeBarKey(name: string): string {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Normalizes a drink name for duplicate & cross-bar matching.
 * Strips accents, lowercases, normalizes punctuation (parentheses, hyphens, quotes, slashes), and collapses whitespace.
 * e.g. "Pilsner (Vaasje)" -> "pilsner vaasje"
 *      "Jägermeister" -> "jagermeister"
 */
export function normalizeDrinkKey(name: string): string {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’"`()\[\]{},._\/\\+-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Checks if two bar names match, ignoring accents, casing, and spacing differences.
 */
export function areBarNamesEquivalent(nameA: string, nameB: string): boolean {
  return normalizeBarKey(nameA) === normalizeBarKey(nameB);
}

/**
 * Checks if two drink names match, ignoring accents, casing, punctuation, and spacing differences.
 */
export function areDrinkNamesEquivalent(nameA: string, nameB: string): boolean {
  const keyA = normalizeDrinkKey(nameA);
  const keyB = normalizeDrinkKey(nameB);
  return keyA.length > 0 && keyA === keyB;
}

/**
 * Creates a unique composite signature for a drink variant within a specific bar:
 * normalizedBarKey + normalizedDrinkKey + rounded volumeMl.
 */
export function getBarDrinkVariantKey(
  drink: Pick<DrinkItem, 'name' | 'barName' | 'volumeMl'>
): string {
  const barKey = normalizeBarKey(drink.barName || DEFAULT_BAR_NAME);
  const drinkKey = normalizeDrinkKey(drink.name);
  const volKey = Math.round(Number(drink.volumeMl) || 0);
  return `${barKey}::${drinkKey}::${volKey}`;
}

/**
 * Checks if a candidate drink is a duplicate of an existing drink IN THE SAME BAR.
 * A beer at Bar A and the same beer at Bar B are NEVER duplicates.
 * Within the same bar:
 * - 'exact': Same normalized drink name, same volumeMl, same ABV, and same price.
 * - 'same_variant': Same normalized drink name and same volumeMl, but different price or ABV.
 * - 'same_name_diff_volume': Same normalized drink name in the same bar, but a different volumeMl (e.g., 250ml vs 500ml).
 */
export function findDuplicateDrinkInBar(
  drinks: DrinkItem[],
  candidate: {
    id?: string;
    name: string;
    barName?: string;
    volumeMl: number;
    abv: number;
    price: number;
  }
): DuplicateCheckResult | null {
  if (!drinks || drinks.length === 0 || !candidate.name?.trim()) return null;

  const targetBarKey = normalizeBarKey(candidate.barName || DEFAULT_BAR_NAME);
  const targetDrinkKey = normalizeDrinkKey(candidate.name);
  if (!targetDrinkKey) return null;

  const sameNameInBar = drinks.filter((d) => {
    if (candidate.id && d.id === candidate.id) return false;
    const dBarKey = normalizeBarKey(d.barName || DEFAULT_BAR_NAME);
    if (dBarKey !== targetBarKey) return false;
    return normalizeDrinkKey(d.name) === targetDrinkKey;
  });

  if (sameNameInBar.length === 0) return null;

  const candidateVol = Math.round(Number(candidate.volumeMl) || 0);
  const sameVolumeMatch = sameNameInBar.find(
    (d) => Math.round(Number(d.volumeMl) || 0) === candidateVol
  );

  if (sameVolumeMatch) {
    const isSameAbv = Math.abs((Number(sameVolumeMatch.abv) || 0) - (Number(candidate.abv) || 0)) < 0.01;
    const isSamePrice =
      Math.abs((Number(sameVolumeMatch.price) || 0) - (Number(candidate.price) || 0)) < 0.005;

    if (isSameAbv && isSamePrice) {
      return {
        matchType: 'exact',
        existingDrink: sameVolumeMatch,
        allSameNameInBar: sameNameInBar,
      };
    }

    return {
      matchType: 'same_variant',
      existingDrink: sameVolumeMatch,
      allSameNameInBar: sameNameInBar,
    };
  }

  return {
    matchType: 'same_name_diff_volume',
    existingDrink: sameNameInBar[0],
    allSameNameInBar: sameNameInBar,
  };
}

/**
 * Deduplicates drinks PER BAR (same bar + same normalized drink name + same volumeMl).
 * Drinks with the same name at DIFFERENT bars are always preserved.
 * @param prefer 'first' keeps the earliest item in the array; 'latest' updates with the later item's values.
 */
export function deduplicateDrinksPerBar(
  drinks: DrinkItem[],
  prefer: 'first' | 'latest' = 'first'
): { drinks: DrinkItem[]; duplicatesRemoved: number } {
  if (!drinks || drinks.length === 0) {
    return { drinks: [], duplicatesRemoved: 0 };
  }

  const consolidated = consolidateDrinksBars(drinks);
  const variantMap = new Map<string, number>(); // key -> index in result
  const result: DrinkItem[] = [];
  let duplicatesRemoved = 0;

  for (const rawDrink of consolidated) {
    const drink = sanitizeDrinkItem(rawDrink);
    const key = getBarDrinkVariantKey(drink);
    const existingIndex = variantMap.get(key);

    if (existingIndex === undefined) {
      variantMap.set(key, result.length);
      result.push(drink);
    } else {
      duplicatesRemoved++;
      if (prefer === 'latest') {
        const prev = result[existingIndex];
        result[existingIndex] = {
          ...prev,
          ...drink,
          id: prev.id, // preserve stable id
          barName: prev.barName, // preserve canonical barName
        };
      }
    }
  }

  return { drinks: result, duplicatesRemoved };
}

/**
 * Smartly adds or updates a drink in a bar:
 * - 'update_existing' (default): If a drink with the same name & volumeMl already exists in the same bar,
 *   updates that existing drink (or skips if 100% identical) instead of creating a duplicate.
 * - 'force_add': Always adds as a new drink entry.
 */
export function upsertDrinkInBar(
  drinks: DrinkItem[],
  newDrink: DrinkItem,
  mode: 'update_existing' | 'force_add' = 'update_existing',
  knownBars: string[] = []
): {
  drinks: DrinkItem[];
  action: 'added' | 'updated' | 'unchanged_duplicate';
  drink: DrinkItem;
} {
  const allBars = Array.from(new Set([...getUniqueBars(drinks), ...knownBars]));
  const canonicalBar = canonicalizeBarName(newDrink.barName || DEFAULT_BAR_NAME, allBars);
  const cleanedDrink = sanitizeDrinkItem({
    ...newDrink,
    barName: canonicalBar,
  });

  if (mode === 'force_add') {
    return {
      drinks: consolidateDrinksBars([cleanedDrink, ...drinks]),
      action: 'added',
      drink: cleanedDrink,
    };
  }

  const dup = findDuplicateDrinkInBar(drinks, cleanedDrink);
  if (dup && (dup.matchType === 'exact' || dup.matchType === 'same_variant')) {
    const existing = dup.existingDrink;
    const updatedItem: DrinkItem = {
      ...existing,
      name: cleanedDrink.name || existing.name,
      category: cleanedDrink.category,
      volumeMl: cleanedDrink.volumeMl,
      abv: cleanedDrink.abv,
      price: cleanedDrink.price,
      barName: existing.barName || canonicalBar,
      notes: cleanedDrink.notes || existing.notes,
    };

    const updatedList = drinks.map((d) => (d.id === existing.id ? updatedItem : d));
    return {
      drinks: consolidateDrinksBars(updatedList),
      action: dup.matchType === 'exact' ? 'unchanged_duplicate' : 'updated',
      drink: updatedItem,
    };
  }

  return {
    drinks: consolidateDrinksBars([cleanedDrink, ...drinks]),
    action: 'added',
    drink: cleanedDrink,
  };
}

/**
 * Merges a batch of imported/scanned/preset drinks into the existing drink list with per-bar duplicate handling.
 * - First deduplicates the incoming batch itself per bar.
 * - Then merges into existingDrinks according to conflictStrategy:
 *   - 'update': updates price/ABV of matching (bar + name + volumeMl) drinks, skips exact matches, adds new ones.
 *   - 'skip': skips any drink that already exists (same bar + name + volumeMl), adds only new ones.
 *   - 'add_all': adds all items without checking existing drinks.
 */
export function mergeDrinksBatch(
  existingDrinks: DrinkItem[],
  incomingDrinks: DrinkItem[],
  conflictStrategy: 'update' | 'skip' | 'add_all' = 'update',
  knownBars: string[] = []
): {
  drinks: DrinkItem[];
  addedCount: number;
  updatedCount: number;
  skippedCount: number;
} {
  if (!incomingDrinks || incomingDrinks.length === 0) {
    return {
      drinks: existingDrinks,
      addedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
    };
  }

  const allKnownBars = Array.from(new Set([...getUniqueBars(existingDrinks), ...knownBars]));
  const normalizedIncoming = incomingDrinks.map((d) =>
    sanitizeDrinkItem({
      ...d,
      barName: canonicalizeBarName(d.barName || DEFAULT_BAR_NAME, allKnownBars),
    })
  );

  // Deduplicate incoming batch against itself first
  const { drinks: uniqueIncoming, duplicatesRemoved: batchInternalDups } = deduplicateDrinksPerBar(
    normalizedIncoming,
    'latest'
  );

  if (conflictStrategy === 'add_all') {
    return {
      drinks: consolidateDrinksBars([...uniqueIncoming, ...existingDrinks]),
      addedCount: uniqueIncoming.length,
      updatedCount: 0,
      skippedCount: batchInternalDups,
    };
  }

  let currentList = [...existingDrinks];
  const newlyAdded: DrinkItem[] = [];
  let addedCount = 0;
  let updatedCount = 0;
  let skippedCount = batchInternalDups;

  for (const candidate of uniqueIncoming) {
    const dup = findDuplicateDrinkInBar(currentList, candidate);

    if (!dup || dup.matchType === 'same_name_diff_volume') {
      newlyAdded.push(candidate);
      currentList = [candidate, ...currentList];
      addedCount++;
    } else if (dup.matchType === 'exact') {
      skippedCount++;
    } else if (dup.matchType === 'same_variant') {
      if (conflictStrategy === 'skip') {
        skippedCount++;
      } else {
        // 'update'
        const existingId = dup.existingDrink.id;
        currentList = currentList.map((d) =>
          d.id === existingId
            ? {
                ...d,
                name: candidate.name || d.name,
                category: candidate.category,
                volumeMl: candidate.volumeMl,
                abv: candidate.abv,
                price: candidate.price,
                notes: candidate.notes || d.notes,
              }
            : d
        );
        updatedCount++;
      }
    }
  }

  // Put newly added items at the top of the list
  const existingUpdated = currentList.filter((d) => !newlyAdded.some((n) => n.id === d.id));
  return {
    drinks: consolidateDrinksBars([...newlyAdded, ...existingUpdated]),
    addedCount,
    updatedCount,
    skippedCount,
  };
}

/**
 * Finds if a bar name matches any existing bar in a list (ignoring accents and case).
 * If matched, returns the existing canonical string.
 * If not matched, returns the trimmed input name.
 */
export function canonicalizeBarName(inputName: string, existingBars: string[]): string {
  const trimmed = inputName?.trim();
  if (!trimmed) return DEFAULT_BAR_NAME;
  const key = normalizeBarKey(trimmed);

  for (const bar of existingBars) {
    if (normalizeBarKey(bar) === key) {
      return bar;
    }
  }
  return trimmed;
}

/**
 * Consolidates all drinks' barNames so that variations like
 * "Café in de Blaauwe Hand" and "Cafe in de Blaauwe Hand"
 * are unified into a single canonical barName across all drinks.
 */
export function consolidateDrinksBars(
  drinks: DrinkItem[],
  preferredCanonicalBars: string[] = []
): DrinkItem[] {
  if (!drinks || drinks.length === 0) return [];
  const keyToCanonical = new Map<string, string>();

  // Register preferred canonical bar names first (if provided)
  for (const bar of preferredCanonicalBars) {
    const raw = bar?.trim();
    if (!raw) continue;
    const key = normalizeBarKey(raw);
    if (key && !keyToCanonical.has(key)) {
      keyToCanonical.set(key, raw);
    }
  }

  // First pass: register the primary display name for each key
  for (const d of drinks) {
    const raw = d.barName?.trim() || DEFAULT_BAR_NAME;
    const key = normalizeBarKey(raw);
    if (!keyToCanonical.has(key)) {
      keyToCanonical.set(key, raw);
    }
  }

  // Second pass: map every drink's barName to the canonical name
  return drinks.map((d) => {
    const raw = d.barName?.trim() || DEFAULT_BAR_NAME;
    const key = normalizeBarKey(raw);
    const canonical = keyToCanonical.get(key) || raw;
    if (d.barName === canonical) return d;
    return { ...d, barName: canonical };
  });
}

/**
 * Extracts list of unique bar names from drinks and optional managed bars list, ignoring accent/case differences.
 */
export function getUniqueBars(drinks: DrinkItem[], extraBars: string[] = []): string[] {
  const keyToBar = new Map<string, string>();

  for (const d of drinks) {
    const name = d.barName?.trim() || DEFAULT_BAR_NAME;
    const key = normalizeBarKey(name);
    if (key && !keyToBar.has(key)) {
      keyToBar.set(key, name);
    }
  }

  for (const b of extraBars) {
    const name = b?.trim();
    if (!name) continue;
    const key = normalizeBarKey(name);
    if (key && !keyToBar.has(key)) {
      keyToBar.set(key, name);
    }
  }

  return Array.from(keyToBar.values()).sort((a, b) => a.localeCompare(b));
}

/**
 * Filters drinks by selected bar ('all' returns all drinks), ignoring accent/case differences.
 */
export function filterDrinksByBar(drinks: DrinkItem[], selectedBar: string): DrinkItem[] {
  if (!selectedBar || selectedBar === 'all') return drinks;
  const targetKey = normalizeBarKey(selectedBar);
  return drinks.filter((d) => normalizeBarKey(d.barName || DEFAULT_BAR_NAME) === targetKey);
}

/**
 * Deletes all drinks associated with a specific bar (accent-insensitive, case-insensitive & trimmed).
 */
export function deleteDrinksForBar(drinks: DrinkItem[], barNameToDelete: string): DrinkItem[] {
  if (!barNameToDelete) return drinks;
  const targetKey = normalizeBarKey(barNameToDelete);
  return drinks.filter(
    (d) => normalizeBarKey(d.barName || DEFAULT_BAR_NAME) !== targetKey
  );
}

/**
 * Renames a bar across all drinks. If renamed to an existing bar name,
 * merges the two bars and deduplicates identical (name + volume) drinks within the merged bar.
 */
export function renameBarInDrinks(
  drinks: DrinkItem[],
  oldBarName: string,
  newBarName: string,
  existingBars: string[] = []
): { drinks: DrinkItem[]; canonicalNewName: string; mergedDuplicatesRemoved: number } {
  const trimmedNew = newBarName?.trim();
  if (!oldBarName || !trimmedNew) {
    return { drinks, canonicalNewName: oldBarName, mergedDuplicatesRemoved: 0 };
  }

  const oldKey = normalizeBarKey(oldBarName);
  const otherBars = existingBars.filter((b) => normalizeBarKey(b) !== oldKey);
  const canonicalNewName = canonicalizeBarName(trimmedNew, otherBars);

  const renamed = drinks.map((d) => {
    const dKey = normalizeBarKey(d.barName || DEFAULT_BAR_NAME);
    if (dKey === oldKey) {
      return { ...d, barName: canonicalNewName };
    }
    return d;
  });

  const { drinks: deduplicated, duplicatesRemoved } = deduplicateDrinksPerBar(renamed, 'first');
  return {
    drinks: deduplicated,
    canonicalNewName,
    mergedDuplicatesRemoved: duplicatesRemoved,
  };
}

/**
 * Calculates bar summary stats across multiple bars (including any empty managed bars).
 */
export function calculateBarSummaries(
  drinks: DrinkItem[],
  extraBars: string[] = []
): BarSummary[] {
  const bars = getUniqueBars(drinks, extraBars);

  return bars
    .map((barName) => {
      const barDrinks = filterDrinksByBar(drinks, barName);
      const ranked = rankDrinks(barDrinks);

      if (ranked.length === 0) {
        return {
          barName,
          drinkCount: 0,
          bestDrink: null,
          worstDrink: null,
          averageKrentScore: 0,
          averageStandardDrinkCost: 0,
          averagePricePerLiter: 0,
          cheapestDrink: null,
        };
      }

      const totalKrent = ranked.reduce((acc, d) => acc + d.pureAlcoholPerCurrency, 0);
      const totalCost = ranked.reduce((acc, d) => acc + d.costPerStandardDrink, 0);
      const totalPricePerLiter = ranked.reduce((acc, d) => acc + d.pricePerLiter, 0);
      const sortedByPrice = [...ranked].sort((a, b) => a.price - b.price);

      return {
        barName,
        drinkCount: ranked.length,
        bestDrink: ranked[0],
        worstDrink: ranked[ranked.length - 1],
        averageKrentScore: Number((totalKrent / ranked.length).toFixed(3)),
        averageStandardDrinkCost: Number((totalCost / ranked.length).toFixed(2)),
        averagePricePerLiter: Number((totalPricePerLiter / ranked.length).toFixed(2)),
        cheapestDrink: sortedByPrice[0],
      };
    })
    .sort((a, b) => {
      if (a.drinkCount === 0 && b.drinkCount > 0) return 1;
      if (b.drinkCount === 0 && a.drinkCount > 0) return -1;
      if (b.averageKrentScore !== a.averageKrentScore) {
        return b.averageKrentScore - a.averageKrentScore;
      }
      return a.barName.localeCompare(b.barName);
    });
}

/**
 * Finds drinks that appear across multiple bars (same normalized drink name + volumeMl)
 * so users can compare where the exact same drink (e.g. "Heineken Vaasje 250ml" or "Duvel 330ml")
 * is cheapest and offers the best KrentProcent score.
 */
export function findCrossBarCommonDrinks(drinks: DrinkItem[]): CrossBarDrinkComparison[] {
  if (!drinks || drinks.length === 0) return [];

  const groups = new Map<string, CalculatedDrink[]>();

  for (const d of drinks) {
    const calc = calculateDrinkMetrics(d);
    const groupKey = `${normalizeDrinkKey(d.name)}::${Math.round(d.volumeMl)}`;
    const list = groups.get(groupKey) || [];
    list.push(calc);
    groups.set(groupKey, list);
  }

  const comparisons: CrossBarDrinkComparison[] = [];

  for (const [groupKey, list] of groups.entries()) {
    // Keep only unique bars within this group
    const uniqueBarsInGroup = new Set(list.map((d) => normalizeBarKey(d.barName || DEFAULT_BAR_NAME)));
    if (uniqueBarsInGroup.size < 2) continue;

    // Sort descending by Krent score, then lowest price
    const sorted = [...list].sort((a, b) => {
      if (b.pureAlcoholPerCurrency !== a.pureAlcoholPerCurrency) {
        return b.pureAlcoholPerCurrency - a.pureAlcoholPerCurrency;
      }
      return a.price - b.price;
    });

    const bestEntry = sorted[0];
    const worstEntry = sorted[sorted.length - 1];
    const prices = sorted.map((d) => d.price);
    const maxPriceDifference = Number((Math.max(...prices) - Math.min(...prices)).toFixed(2));
    const maxValueAdvantagePercent =
      worstEntry.pureAlcoholPerCurrency > 0
        ? Number(
            (
              ((bestEntry.pureAlcoholPerCurrency - worstEntry.pureAlcoholPerCurrency) /
                worstEntry.pureAlcoholPerCurrency) *
              100
            ).toFixed(1)
          )
        : 0;

    comparisons.push({
      groupKey,
      displayName: bestEntry.name,
      category: bestEntry.category,
      volumeMl: bestEntry.volumeMl,
      abv: bestEntry.abv,
      entries: sorted,
      bestEntry,
      worstEntry,
      maxPriceDifference,
      maxValueAdvantagePercent,
    });
  }

  return comparisons.sort((a, b) => {
    if (b.entries.length !== a.entries.length) return b.entries.length - a.entries.length;
    return b.maxValueAdvantagePercent - a.maxValueAdvantagePercent;
  });
}

/**
 * Ranks drinks by pure alcohol per currency (highest value first).
 * Annotates each with its rank and percentage difference compared to the #1 top deal.
 */
export function rankDrinks(drinks: DrinkItem[]): CalculatedDrink[] {
  if (!drinks || drinks.length === 0) return [];

  const calculated = drinks.map(calculateDrinkMetrics);

  // Sort descending by value score (pure alcohol per currency), with deterministic tie-breakers
  calculated.sort((a, b) => {
    if (b.pureAlcoholPerCurrency !== a.pureAlcoholPerCurrency) {
      return b.pureAlcoholPerCurrency - a.pureAlcoholPerCurrency;
    }
    if (a.price !== b.price) {
      return a.price - b.price;
    }
    if (b.pureAlcoholMl !== a.pureAlcoholMl) {
      return b.pureAlcoholMl - a.pureAlcoholMl;
    }
    return a.name.localeCompare(b.name);
  });

  const bestScore = calculated[0]?.pureAlcoholPerCurrency || 0;

  return calculated.map((item, index) => {
    let percentageRelativeToBest = 0;
    if (bestScore > 0 && item.pureAlcoholPerCurrency > 0) {
      percentageRelativeToBest = Number(
        (((item.pureAlcoholPerCurrency - bestScore) / bestScore) * 100).toFixed(1)
      );
    } else if (bestScore > 0 && item.pureAlcoholPerCurrency === 0) {
      percentageRelativeToBest = -100;
    }

    return {
      ...item,
      efficiencyRank: index + 1,
      percentageRelativeToBest,
    };
  });
}

/**
 * Formats currency neatly with chosen symbol
 */
export function formatCurrency(amount: number, symbol = '€'): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return `${symbol}${safeAmount.toFixed(2)}`;
}
