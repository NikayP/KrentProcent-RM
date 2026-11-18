import test from 'node:test';
import assert from 'node:assert/strict';
import { ALLOWED_SCAN_MIME_TYPES, normalizeScanMimeType } from './scanMime.ts';
import { parseVisionResponse } from './visionParser.ts';

test('normalizeScanMimeType accepts all whitelisted image and PDF MIME types', () => {
  for (const mime of ALLOWED_SCAN_MIME_TYPES) {
    assert.equal(normalizeScanMimeType(mime), mime);
    assert.equal(normalizeScanMimeType(`  ${mime.toUpperCase()}  `), mime);
  }
  assert.equal(normalizeScanMimeType('image/jpg'), 'image/jpeg');
  assert.equal(normalizeScanMimeType('application/pdf; charset=utf-8'), 'application/pdf');
});

test('normalizeScanMimeType rejects unsupported or malformed MIME types', () => {
  assert.equal(normalizeScanMimeType('image/svg+xml'), null);
  assert.equal(normalizeScanMimeType('text/html'), null);
  assert.equal(normalizeScanMimeType('application/javascript'), null);
  assert.equal(normalizeScanMimeType(''), null);
  assert.equal(normalizeScanMimeType(null), null);
  assert.equal(normalizeScanMimeType(undefined), null);
  assert.equal(normalizeScanMimeType(123), null);
});

test('parseVisionResponse parses pipe-delimited vision output, BAR header, 0.0% ABV, and OCR price glitches', () => {
  const raw = [
    'BAR|Café De Opera',
    'Name|Cat|VolumeMl|ABV|Price',
    'Brand Pilsener|b|250|3.7|3,70',
    'Heineken 0.0|b|330|5.0|3.50',
    'Westmalle Tripel|b|330|9.5|7.03',
    'Huiswijn Rood|w|150|12.5|4,90',
  ].join('\n');

  const res = parseVisionResponse(raw);
  assert.equal(res.detectedBarName, 'Café De Opera');
  assert.equal(res.drinks.length, 4);

  assert.equal(res.drinks[0].name, 'Brand Pilsener');
  assert.equal(res.drinks[0].abv, 5.0); // price-as-ABV corrected
  assert.equal(res.drinks[1].abv, 0); // 0.0% strictly forced
  assert.equal(res.drinks[2].price, 7.0); // 7.03 OCR glitch snapped to 7.00
  assert.equal(res.drinks[3].category, 'wine');
  assert.equal(res.drinks[3].price, 4.9);
});

test('parseVisionResponse parses fenced JSON fallback and respects userSpecifiedBar', () => {
  const raw = [
    '```json',
    '{"detectedBarName":"Ignored","drinks":[{"name":"La Chouffe","category":"beer","volumeMl":330,"abv":8,"price":5.8}]}',
    '```',
  ].join('\n');

  const res = parseVisionResponse(raw, 'Gollem');
  assert.equal(res.detectedBarName, 'Gollem');
  assert.equal(res.drinks.length, 1);
  assert.equal(res.drinks[0].barName, 'Gollem');
  assert.equal(res.drinks[0].name, 'La Chouffe');
});
