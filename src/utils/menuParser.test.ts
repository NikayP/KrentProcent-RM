import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMenuFallback } from './menuParser.ts';

test('parseMenuFallback parses beer, wine, and 0.0% drinks from pasted menu text', () => {
  const input = [
    '--- CAFÉ HET HOK DRINKS MENU ---',
    'Heineken Vaasje 25cl 5% €3.60',
    'Heineken 0.0 33cl €3.50',
    'Tripel Karmeliet 33cl 8.4% €5.90',
    'Huiswijn Chardonnay 150ml €5.20',
  ].join('\n');

  const result = parseMenuFallback(input);

  assert.equal(result.detectedBarName, 'Café Het Hok');
  assert.equal(result.drinks.length, 4);

  assert.equal(result.drinks[0].name, 'Heineken Vaasje');
  assert.equal(result.drinks[0].volumeMl, 250);
  assert.equal(result.drinks[0].abv, 5);
  assert.equal(result.drinks[0].price, 3.6);

  assert.equal(result.drinks[1].abv, 0);
  assert.equal(result.drinks[2].abv, 8.4);
  assert.equal(result.drinks[3].category, 'wine');
  assert.equal(result.drinks[3].volumeMl, 150);
});

test('parseMenuFallback prefers userSpecifiedBar over header bar name', () => {
  const input = '--- WRONG BAR MENU ---\nGuinness Pint €6.80';
  const result = parseMenuFallback(input, 'De Kroon');

  assert.equal(result.detectedBarName, 'De Kroon');
  assert.equal(result.drinks[0].barName, 'De Kroon');
  assert.equal(result.drinks[0].volumeMl, 500);
});
