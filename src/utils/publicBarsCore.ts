import {
  type DrinkCategory,
  type DrinkItem,
  deduplicateDrinksPerBar,
  filterDrinksByBar,
  sanitizeDrinkItem,
} from './calculator.ts';

export const MAX_PUBLIC_BAR_NAME_LENGTH = 80;
export const MAX_PUBLIC_CITY_LENGTH = 60;
export const MAX_PUBLIC_DRINK_NAME_LENGTH = 120;
export const MAX_PUBLIC_DRINKS_COUNT = 300;
export const MAX_SEARCH_QUERY_LENGTH = 60;

export interface PublicBarSummary {
  id: string;
  username: string;
  barName: string;
  city: string | null;
  drinkCount: number;
  updatedAt: string;
}

export interface MyPublicBar {
  id: string;
  barKey: string;
  barName: string;
  city: string | null;
  hash: string;
}

export interface PublicDrinkRecord {
  name: string;
  barName: string;
  category: DrinkCategory;
  volumeMl: number;
  abv: number;
  price: number;
}

export function sanitizeCity(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().slice(0, MAX_PUBLIC_CITY_LENGTH);
  return trimmed ? trimmed : null;
}

export function normalizeSearchQuery(raw: string): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
}

/**
 * Extracts and strips private fields (id, notes) from a bar's drinks before publishing.
 */
export function preparePublicDrinks(
  drinks: DrinkItem[],
  barName: string
): PublicDrinkRecord[] {
  const barDrinks = filterDrinksByBar(drinks, barName);
  const cleanBarName = barName.trim().slice(0, MAX_PUBLIC_BAR_NAME_LENGTH) || 'Current Bar';

  return barDrinks.slice(0, MAX_PUBLIC_DRINKS_COUNT).map((d) => {
    const clean = sanitizeDrinkItem({
      name: (d.name || '').trim().slice(0, MAX_PUBLIC_DRINK_NAME_LENGTH),
      barName: cleanBarName,
      category: d.category,
      volumeMl: d.volumeMl,
      abv: d.abv,
      price: d.price,
    });
    return {
      name: clean.name.slice(0, MAX_PUBLIC_DRINK_NAME_LENGTH),
      barName: cleanBarName,
      category: clean.category,
      volumeMl: clean.volumeMl,
      abv: clean.abv,
      price: clean.price,
    };
  });
}

/**
 * Sanitizes untrusted JSON drinks fetched from a public bar into safe local DrinkItems
 * with fresh IDs so they never collide with local or preset IDs.
 */
export function prepareAdoptedDrinks(
  raw: unknown,
  targetBarName: string
): DrinkItem[] {
  if (!Array.isArray(raw)) return [];
  const cleanBarName =
    targetBarName.trim().slice(0, MAX_PUBLIC_BAR_NAME_LENGTH) || 'Shared Bar';

  const sanitized: DrinkItem[] = [];
  for (const item of raw.slice(0, MAX_PUBLIC_DRINKS_COUNT)) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const rawName = typeof obj.name === 'string' ? obj.name.trim() : '';
    if (!rawName) continue;

    const clean = sanitizeDrinkItem({
      name: rawName.slice(0, MAX_PUBLIC_DRINK_NAME_LENGTH),
      barName: cleanBarName,
      category: typeof obj.category === 'string' ? (obj.category as DrinkCategory) : 'beer',
      volumeMl: Number(obj.volumeMl),
      abv: Number(obj.abv),
      price: Number(obj.price),
    });

    if (clean.price > 0 && clean.volumeMl > 0) {
      sanitized.push(clean);
    }
  }

  return deduplicateDrinksPerBar(sanitized, 'first').drinks;
}

/**
 * Produces an order-independent fingerprint of a bar's drinks for auto-sync diffing.
 */
export function hashBarDrinks(
  drinks: Array<Pick<DrinkItem, 'name' | 'category' | 'volumeMl' | 'abv' | 'price'>>
): string {
  return drinks
    .map(
      (d) =>
        `${(d.name || '').trim().toLowerCase()}|${d.category}|${d.volumeMl}|${d.abv}|${d.price}`
    )
    .sort()
    .join('\n');
}

export function formatRelativeUpdatedAt(
  isoDate: string,
  nowMs = Date.now()
): string {
  const ts = Date.parse(isoDate);
  if (!Number.isFinite(ts)) return '';
  const diffSec = Math.max(0, Math.floor((nowMs - ts) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(ts).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}
