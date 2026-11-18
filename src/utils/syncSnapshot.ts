import type { DrinkItem } from './calculator.ts';
import { POPULAR_BAR_PRESETS } from '../presets/barData.ts';

/**
 * Produces a deterministic fingerprint of the user's board (drinks + managed bars)
 * used to detect whether local state actually differs from the last synced cloud snapshot.
 */
export function computeBoardSnapshot(drinks: DrinkItem[], managedBars: string[]): string {
  const drinkSig = drinks
    .map(
      (d) =>
        `${d.id}|${d.name}|${d.barName || ''}|${d.category}|${d.volumeMl}|${d.abv}|${d.price}|${d.notes || ''}`
    )
    .join('\n');
  const barsSig = managedBars.join('|');
  return `${barsSig}##${drinkSig}`;
}

/**
 * Returns true if the local board still matches the initial untouched preset seed.
 */
export function isUntouchedPresetBoard(
  currentDrinks: DrinkItem[],
  currentManagedBars: string[]
): boolean {
  return (
    currentManagedBars.length === 0 &&
    currentDrinks.length === POPULAR_BAR_PRESETS.length &&
    currentDrinks.every(
      (d, idx) =>
        d.id === POPULAR_BAR_PRESETS[idx]?.id &&
        d.price === POPULAR_BAR_PRESETS[idx]?.price
    )
  );
}
