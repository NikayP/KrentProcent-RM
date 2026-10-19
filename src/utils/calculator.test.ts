import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePureAlcoholMl,
  calculateAlcoholPerCurrency,
  calculateCostPerStandardDrink,
  calculateDrinkMetrics,
  rankDrinks,
  getUniqueBars,
  filterDrinksByBar,
  calculateBarSummaries,
  deleteDrinksForBar,
  normalizeBarKey,
  normalizeDrinkKey,
  areBarNamesEquivalent,
  areDrinkNamesEquivalent,
  canonicalizeBarName,
  consolidateDrinksBars,
  findDuplicateDrinkInBar,
  deduplicateDrinksPerBar,
  upsertDrinkInBar,
  mergeDrinksBatch,
  renameBarInDrinks,
  findCrossBarCommonDrinks,
  sanitizeDrinkItem,
} from './calculator.ts';
import type { DrinkItem } from './calculator.ts';

test('calculatePureAlcoholMl computes correct pure alcohol volume and handles edge cases', () => {
  // 500ml beer at 5% = 25ml
  assert.equal(calculatePureAlcoholMl(500, 5), 25);
  // 330ml Belgian Tripel at 8.5% = 28.05ml
  assert.equal(calculatePureAlcoholMl(330, 8.5), 28.05);
  // 35ml shot at 40% = 14ml
  assert.equal(calculatePureAlcoholMl(35, 40), 14);
  // 0 volume, negative, or NaN
  assert.equal(calculatePureAlcoholMl(0, 5), 0);
  assert.equal(calculatePureAlcoholMl(500, 0), 0);
  assert.equal(calculatePureAlcoholMl(-100, 5), 0);
  assert.equal(calculatePureAlcoholMl(Number.NaN, 5), 0);
  // Clamps ABV > 100 to 100
  assert.equal(calculatePureAlcoholMl(100, 150), 100);
});

test('calculateAlcoholPerCurrency computes pure ml per currency unit', () => {
  // 25ml alcohol for €5.00 => 5 ml/€
  assert.equal(calculateAlcoholPerCurrency(25, 5), 5);
  // 28.05ml alcohol for €6.00 => 4.675 ml/€
  assert.equal(Number(calculateAlcoholPerCurrency(28.05, 6).toFixed(3)), 4.675);
  // Zero price, negative, or NaN
  assert.equal(calculateAlcoholPerCurrency(25, 0), 0);
  assert.equal(calculateAlcoholPerCurrency(0, 5), 0);
  assert.equal(calculateAlcoholPerCurrency(25, Number.NaN), 0);
});

test('calculateCostPerStandardDrink calculates cost for 12.5ml unit', () => {
  // If 25ml costs €5, 12.5ml costs €2.50
  assert.equal(calculateCostPerStandardDrink(25, 5, 12.5), 2.5);
  assert.equal(calculateCostPerStandardDrink(0, 5, 12.5), 0);
});

test('calculateDrinkMetrics returns complete metric object with standardDrinks and pricePerLiter', () => {
  const drink: DrinkItem = {
    id: 'test-1',
    name: 'Pilsner Pint',
    category: 'beer',
    volumeMl: 500,
    abv: 5.0,
    price: 5.0,
    barName: 'Café Gollem',
  };
  const metrics = calculateDrinkMetrics(drink);
  assert.equal(metrics.pureAlcoholMl, 25);
  assert.equal(metrics.pureAlcoholPerCurrency, 5);
  assert.equal(metrics.costPerStandardDrink, 2.5);
  assert.equal(metrics.standardDrinks, 2);
  assert.equal(metrics.pricePerLiter, 10);
  assert.equal(metrics.pricePer100mlPureAlcohol, 20);
  assert.equal(metrics.barName, 'Café Gollem');
});

test('rankDrinks correctly sorts drinks descending by value and breaks ties deterministically', () => {
  const drinks: DrinkItem[] = [
    {
      id: 'pilsner',
      name: 'Standard Pilsner (250ml, 5% @ €3.50)',
      category: 'beer',
      volumeMl: 250,
      abv: 5.0,
      price: 3.5, // 12.5ml pure / 3.5 = 3.571 ml/€
    },
    {
      id: 'tripel',
      name: 'Belgian Tripel (330ml, 9% @ €5.00)',
      category: 'beer',
      volumeMl: 330,
      abv: 9.0,
      price: 5.0, // 29.7ml pure / 5.0 = 5.94 ml/€ -> WINNER
    },
    {
      id: 'ipa',
      name: 'Craft IPA (330ml, 6.5% @ €5.50)',
      category: 'beer',
      volumeMl: 330,
      abv: 6.5,
      price: 5.5, // 21.45ml pure / 5.5 = 3.9 ml/€
    },
  ];

  const ranked = rankDrinks(drinks);
  assert.equal(ranked[0].id, 'tripel');
  assert.equal(ranked[0].efficiencyRank, 1);
  assert.equal(ranked[0].percentageRelativeToBest, 0);

  assert.equal(ranked[1].id, 'ipa');
  assert.equal(ranked[1].efficiencyRank, 2);

  assert.equal(ranked[2].id, 'pilsner');
  assert.equal(ranked[2].efficiencyRank, 3);
  assert.ok(ranked[2].percentageRelativeToBest! < 0);
});

test('getUniqueBars and filterDrinksByBar isolate drinks for specific bar and include extra managed bars', () => {
  const drinks: DrinkItem[] = [
    { id: '1', name: 'Beer A', category: 'beer', volumeMl: 250, abv: 5, price: 3.5, barName: 'Bar X' },
    { id: '2', name: 'Beer B', category: 'beer', volumeMl: 500, abv: 5, price: 6.0, barName: 'Bar X' },
    { id: '3', name: 'Beer C', category: 'beer', volumeMl: 330, abv: 8, price: 5.5, barName: 'Bar Y' },
  ];

  const bars = getUniqueBars(drinks, ['Bar Z (Empty)', 'bar x']);
  assert.deepEqual(bars, ['Bar X', 'Bar Y', 'Bar Z (Empty)']);

  const barXDrinks = filterDrinksByBar(drinks, 'Bar X');
  assert.equal(barXDrinks.length, 2);

  const barYDrinks = filterDrinksByBar(drinks, 'Bar Y');
  assert.equal(barYDrinks.length, 1);
});

test('calculateBarSummaries computes bar comparison metrics including empty bars', () => {
  const drinks: DrinkItem[] = [
    { id: '1', name: 'Beer A', category: 'beer', volumeMl: 250, abv: 5, price: 3.5, barName: 'Bar Cheap' },
    { id: '2', name: 'Beer B', category: 'beer', volumeMl: 250, abv: 5, price: 5.0, barName: 'Bar Expensive' },
  ];

  const summaries = calculateBarSummaries(drinks, ['Bar Empty']);
  assert.equal(summaries.length, 3);
  assert.equal(summaries[0].barName, 'Bar Cheap');
  assert.equal(summaries[1].barName, 'Bar Expensive');
  assert.equal(summaries[2].barName, 'Bar Empty');
  assert.equal(summaries[2].drinkCount, 0);
  assert.ok(summaries[0].averageKrentScore > summaries[1].averageKrentScore);
});

test('deleteDrinksForBar removes all drinks belonging to specified bar', () => {
  const drinks: DrinkItem[] = [
    { id: '1', name: 'Beer 1', category: 'beer', volumeMl: 250, abv: 5, price: 3.5, barName: 'Bar To Delete' },
    { id: '2', name: 'Beer 2', category: 'beer', volumeMl: 500, abv: 5, price: 6.0, barName: 'Bar To Delete' },
    { id: '3', name: 'Beer 3', category: 'beer', volumeMl: 330, abv: 8, price: 5.5, barName: 'Bar To Keep' },
  ];

  const updated = deleteDrinksForBar(drinks, 'Bar To Delete');
  assert.equal(updated.length, 1);
  assert.equal(updated[0].barName, 'Bar To Keep');
  assert.equal(updated[0].id, '3');
});

test('areBarNamesEquivalent and normalizeBarKey treat accented/unaccented bar names as identical', () => {
  assert.equal(
    areBarNamesEquivalent('Cafe in de Blaauwe Hand', 'Café in de Blaauwe Hand'),
    true
  );
  assert.equal(
    areBarNamesEquivalent('  Café De Dokter  ', 'Cafe de dokter'),
    true
  );
  assert.equal(
    areBarNamesEquivalent('Café De Zotte', 'Gollem Craft Beer'),
    false
  );
});

test('canonicalizeBarName snaps variations to existing known bar name', () => {
  const existingBars = ['Cafe in de Blaauwe Hand', 'Café De Dokter'];

  const resolved = canonicalizeBarName('Café in de Blaauwe Hand', existingBars);
  assert.equal(resolved, 'Cafe in de Blaauwe Hand');

  const newBar = canonicalizeBarName('The Waterhole', existingBars);
  assert.equal(newBar, 'The Waterhole');
});

test('getUniqueBars and consolidateDrinksBars deduplicate accented/unaccented bar variations', () => {
  const drinksWithDuplicates: DrinkItem[] = [
    { id: '1', name: 'Beer A', category: 'beer', volumeMl: 250, abv: 5, price: 3.5, barName: 'Cafe in de Blaauwe Hand' },
    { id: '2', name: 'Beer B', category: 'beer', volumeMl: 330, abv: 8, price: 5.5, barName: 'Café in de Blaauwe Hand' },
    { id: '3', name: 'Beer C', category: 'beer', volumeMl: 500, abv: 5, price: 6.0, barName: 'Café De Dokter' },
  ];

  const uniqueBars = getUniqueBars(drinksWithDuplicates);
  assert.equal(uniqueBars.length, 2);
  assert.ok(uniqueBars.includes('Cafe in de Blaauwe Hand'));
  assert.ok(uniqueBars.includes('Café De Dokter'));

  const consolidated = consolidateDrinksBars(drinksWithDuplicates);
  assert.equal(consolidated[0].barName, 'Cafe in de Blaauwe Hand');
  assert.equal(consolidated[1].barName, 'Cafe in de Blaauwe Hand');
  assert.equal(consolidated[2].barName, 'Café De Dokter');
});

test('normalizeDrinkKey and areDrinkNamesEquivalent normalize punctuation, accents, and case', () => {
  assert.equal(normalizeDrinkKey('Pilsner (Vaasje)'), 'pilsner vaasje');
  assert.equal(normalizeDrinkKey('  pilsner - vaasje '), 'pilsner vaasje');
  assert.equal(areDrinkNamesEquivalent('Jägermeister Shot', 'Jagermeister (Shot)'), true);
  assert.equal(areDrinkNamesEquivalent('Heineken Vaasje', 'Duvel'), false);
});

test('findDuplicateDrinkInBar detects duplicates ONLY within the same bar and allows the same beer across different bars', () => {
  const existingDrinks: DrinkItem[] = [
    {
      id: 'dokter-vaasje',
      name: 'Pilsner (Vaasje)',
      category: 'beer',
      volumeMl: 250,
      abv: 5.0,
      price: 3.5,
      barName: 'Café De Dokter',
    },
    {
      id: 'zotte-karmeliet',
      name: 'Tripel Karmeliet',
      category: 'beer',
      volumeMl: 330,
      abv: 8.4,
      price: 5.8,
      barName: 'Café De Zotte',
    },
  ];

  // 1. Same beer at a DIFFERENT bar is NOT a duplicate!
  const sameBeerOtherBar = findDuplicateDrinkInBar(existingDrinks, {
    name: 'Pilsner (Vaasje)',
    barName: 'Café De Zotte',
    volumeMl: 250,
    abv: 5.0,
    price: 3.5,
  });
  assert.equal(sameBeerOtherBar, null);

  // 2. Exact match in the SAME bar (even with slight accent/punctuation difference)
  const exactDup = findDuplicateDrinkInBar(existingDrinks, {
    name: 'Pilsner - Vaasje',
    barName: 'Cafe de Dokter',
    volumeMl: 250,
    abv: 5.0,
    price: 3.5,
  });
  assert.ok(exactDup);
  assert.equal(exactDup.matchType, 'exact');
  assert.equal(exactDup.existingDrink.id, 'dokter-vaasje');

  // 3. Same drink & volume in the SAME bar, but updated price -> 'same_variant'
  const variantDup = findDuplicateDrinkInBar(existingDrinks, {
    name: 'Pilsner (Vaasje)',
    barName: 'Café De Dokter',
    volumeMl: 250,
    abv: 5.0,
    price: 3.9,
  });
  assert.ok(variantDup);
  assert.equal(variantDup.matchType, 'same_variant');
  assert.equal(variantDup.existingDrink.id, 'dokter-vaasje');

  // 4. Same drink name in the SAME bar, but different volume (e.g. 500ml instead of 250ml) -> 'same_name_diff_volume'
  const diffVolume = findDuplicateDrinkInBar(existingDrinks, {
    name: 'Pilsner (Vaasje)',
    barName: 'Café De Dokter',
    volumeMl: 500,
    abv: 5.0,
    price: 6.5,
  });
  assert.ok(diffVolume);
  assert.equal(diffVolume.matchType, 'same_name_diff_volume');
});

test('deduplicateDrinksPerBar removes duplicates per bar while preserving identical beers across different bars', () => {
  const list: DrinkItem[] = [
    { id: '1', name: 'Heineken Vaasje', category: 'beer', volumeMl: 250, abv: 5, price: 3.5, barName: 'Café De Dokter' },
    { id: '2', name: 'heineken (vaasje)', category: 'beer', volumeMl: 250, abv: 5, price: 3.8, barName: 'Cafe De Dokter' }, // Duplicate in same bar!
    { id: '3', name: 'Heineken Vaasje', category: 'beer', volumeMl: 250, abv: 5, price: 3.6, barName: 'Café De Zotte' }, // Different bar -> keep!
  ];

  const { drinks: dedupFirst, duplicatesRemoved } = deduplicateDrinksPerBar(list, 'first');
  assert.equal(duplicatesRemoved, 1);
  assert.equal(dedupFirst.length, 2);
  assert.equal(dedupFirst[0].price, 3.5);
  assert.equal(dedupFirst[1].barName, 'Café De Zotte');

  const { drinks: dedupLatest } = deduplicateDrinksPerBar(list, 'latest');
  assert.equal(dedupLatest.length, 2);
  assert.equal(dedupLatest[0].price, 3.8); // Updated with latest price
  assert.equal(dedupLatest[0].id, '1'); // Preserved original ID
});

test('upsertDrinkInBar updates existing drink in same bar or adds new drink if in another bar', () => {
  const initial: DrinkItem[] = [
    { id: 'd1', name: 'Duvel', category: 'beer', volumeMl: 330, abv: 8.5, price: 5.5, barName: 'Bar A' },
  ];

  // Adding Duvel at Bar B -> added as new entry
  const step1 = upsertDrinkInBar(initial, {
    id: 'd2',
    name: 'Duvel',
    category: 'beer',
    volumeMl: 330,
    abv: 8.5,
    price: 6.0,
    barName: 'Bar B',
  });
  assert.equal(step1.action, 'added');
  assert.equal(step1.drinks.length, 2);

  // Adding Duvel at Bar A with new price €5.90 -> updates d1 instead of duplicating!
  const step2 = upsertDrinkInBar(step1.drinks, {
    id: 'd3',
    name: 'duvel',
    category: 'beer',
    volumeMl: 330,
    abv: 8.5,
    price: 5.9,
    barName: 'Bar A',
  });
  assert.equal(step2.action, 'updated');
  assert.equal(step2.drinks.length, 2);
  assert.equal(step2.drink.id, 'd1');
  assert.equal(step2.drink.price, 5.9);
});

test('mergeDrinksBatch deduplicates incoming batch and handles per-bar conflicts', () => {
  const existing: DrinkItem[] = [
    { id: '1', name: 'La Chouffe', category: 'beer', volumeMl: 330, abv: 8.0, price: 5.5, barName: 'Gollem' },
  ];

  const incoming: DrinkItem[] = [
    // Exact duplicate of existing
    { id: '2', name: 'La Chouffe', category: 'beer', volumeMl: 330, abv: 8.0, price: 5.5, barName: 'Gollem' },
    // New drink at Gollem, duplicated twice in the incoming scan
    { id: '3', name: 'Westmalle Tripel', category: 'beer', volumeMl: 330, abv: 9.5, price: 6.0, barName: 'Gollem' },
    { id: '4', name: 'Westmalle (Tripel)', category: 'beer', volumeMl: 330, abv: 9.5, price: 6.2, barName: 'Gollem' },
  ];

  const merged = mergeDrinksBatch(existing, incoming, 'update');
  assert.equal(merged.addedCount, 1); // Westmalle Tripel added once
  assert.equal(merged.skippedCount, 2); // 1 internal batch dup + 1 exact existing dup
  assert.equal(merged.drinks.length, 2);
});

test('renameBarInDrinks renames bar and deduplicates when merging two bars', () => {
  const drinks: DrinkItem[] = [
    { id: '1', name: 'Pilsner Vaasje', category: 'beer', volumeMl: 250, abv: 5.0, price: 3.5, barName: 'Café De Dokter' },
    { id: '2', name: 'Pilsner Vaasje', category: 'beer', volumeMl: 250, abv: 5.0, price: 3.6, barName: 'Dokter Oud' },
    { id: '3', name: 'Speciaalbier', category: 'beer', volumeMl: 330, abv: 7.5, price: 5.2, barName: 'Dokter Oud' },
  ];

  const res = renameBarInDrinks(drinks, 'Dokter Oud', 'Café De Dokter', ['Café De Dokter', 'Dokter Oud']);
  assert.equal(res.canonicalNewName, 'Café De Dokter');
  assert.equal(res.mergedDuplicatesRemoved, 1); // Duplicate Pilsner Vaasje merged!
  assert.equal(res.drinks.length, 2);
});

test('findCrossBarCommonDrinks identifies identical drinks sold across multiple bars', () => {
  const drinks: DrinkItem[] = [
    { id: '1', name: 'Tripel Karmeliet', category: 'beer', volumeMl: 330, abv: 8.4, price: 5.5, barName: 'Bar A' },
    { id: '2', name: 'Tripel (Karmeliet)', category: 'beer', volumeMl: 330, abv: 8.4, price: 6.5, barName: 'Bar B' },
    { id: '3', name: 'Unique Local Brew', category: 'beer', volumeMl: 330, abv: 6.0, price: 5.0, barName: 'Bar A' },
  ];

  const common = findCrossBarCommonDrinks(drinks);
  assert.equal(common.length, 1);
  assert.equal(common[0].entries.length, 2);
  assert.equal(common[0].bestEntry.barName, 'Bar A');
  assert.equal(common[0].worstEntry.barName, 'Bar B');
  assert.equal(common[0].maxPriceDifference, 1.0);
});
