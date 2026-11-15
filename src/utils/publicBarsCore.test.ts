import test from 'node:test';
import assert from 'node:assert/strict';
import type { DrinkItem } from './calculator.ts';
import {
  formatRelativeUpdatedAt,
  hashBarDrinks,
  normalizeSearchQuery,
  prepareAdoptedDrinks,
  preparePublicDrinks,
  sanitizeCity,
} from './publicBarsCore.ts';

const SAMPLE_DRINKS: DrinkItem[] = [
  {
    id: 'preset-pilsner-vaasje',
    name: 'Heineken Vaasje',
    barName: 'Café De Dokter',
    category: 'beer',
    volumeMl: 250,
    abv: 5.0,
    price: 3.6,
    notes: 'Personal note',
  },
  {
    id: 'drink-other-bar',
    name: 'Tripel Karmeliet',
    barName: 'Other Bar',
    category: 'beer',
    volumeMl: 330,
    abv: 8.4,
    price: 5.5,
  },
];

test('preparePublicDrinks filters by bar and strips id and notes', () => {
  const pub = preparePublicDrinks(SAMPLE_DRINKS, 'Cafe De Dokter');
  assert.equal(pub.length, 1);
  assert.equal(pub[0].name, 'Heineken Vaasje');
  assert.equal('id' in pub[0], false);
  assert.equal('notes' in pub[0], false);
});

test('prepareAdoptedDrinks generates fresh IDs and sanitizes malicious input', () => {
  const longName = 'X'.repeat(500);
  const untrusted = [
    {
      id: 'preset-pilsner-vaasje',
      name: longName,
      category: 'beer',
      volumeMl: 330,
      abv: 500,
      price: '4.50',
      notes: '<script>alert(1)</script>',
    },
    {
      name: 'Invalid free item',
      volumeMl: 330,
      abv: 5,
      price: 0,
    },
    null,
    42,
  ];

  const adopted = prepareAdoptedDrinks(untrusted, 'De Kroeg');
  assert.equal(adopted.length, 1);
  assert.notEqual(adopted[0].id, 'preset-pilsner-vaasje');
  assert.ok(adopted[0].id.startsWith('drink-'));
  assert.equal(adopted[0].name.length, 120);
  assert.equal(adopted[0].abv, 100);
  assert.equal(adopted[0].price, 4.5);
  assert.equal(adopted[0].barName, 'De Kroeg');
  assert.equal(adopted[0].notes, undefined);

  assert.deepEqual(prepareAdoptedDrinks('not-an-array', 'De Kroeg'), []);
});

test('hashBarDrinks is stable regardless of drink order', () => {
  const a: DrinkItem = {
    id: '1',
    name: 'Pils',
    barName: 'Bar',
    category: 'beer',
    volumeMl: 250,
    abv: 5,
    price: 3.5,
  };
  const b: DrinkItem = {
    id: '2',
    name: 'Tripel',
    barName: 'Bar',
    category: 'beer',
    volumeMl: 330,
    abv: 8.5,
    price: 5.8,
  };
  assert.equal(hashBarDrinks([a, b]), hashBarDrinks([b, a]));
  assert.notEqual(
    hashBarDrinks([a, b]),
    hashBarDrinks([{ ...a, price: 3.8 }, b])
  );
});

test('normalizeSearchQuery and sanitizeCity trim and cap length', () => {
  assert.equal(normalizeSearchQuery('  @jan  '), '@jan');
  assert.equal(normalizeSearchQuery('a'.repeat(100)).length, 60);
  assert.equal(sanitizeCity('   '), null);
  assert.equal(sanitizeCity('  Utrecht  '), 'Utrecht');
  assert.equal(sanitizeCity('x'.repeat(100))?.length, 60);
});

test('formatRelativeUpdatedAt formats timestamps human-readably', () => {
  const now = Date.UTC(2026, 10, 15, 12, 0, 0);
  assert.equal(formatRelativeUpdatedAt(new Date(now - 20_000).toISOString(), now), 'just now');
  assert.equal(formatRelativeUpdatedAt(new Date(now - 5 * 60_000).toISOString(), now), '5m ago');
  assert.equal(formatRelativeUpdatedAt(new Date(now - 3 * 3600_000).toISOString(), now), '3h ago');
  assert.equal(formatRelativeUpdatedAt(new Date(now - 86400_000).toISOString(), now), 'yesterday');
  assert.equal(formatRelativeUpdatedAt(new Date(now - 4 * 86400_000).toISOString(), now), '4d ago');
});
