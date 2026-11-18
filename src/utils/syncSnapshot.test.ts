import test from 'node:test';
import assert from 'node:assert/strict';
import { computeBoardSnapshot, isUntouchedPresetBoard } from './syncSnapshot.ts';
import { POPULAR_BAR_PRESETS } from '../presets/barData.ts';

test('computeBoardSnapshot produces identical fingerprints for equal boards and detects edits', () => {
  const base = POPULAR_BAR_PRESETS.slice(0, 2);
  const snap1 = computeBoardSnapshot(base, ['Café De Dokter']);
  const snap2 = computeBoardSnapshot(
    base.map((d) => ({ ...d })),
    ['Café De Dokter']
  );
  assert.equal(snap1, snap2);

  const editedPrice = computeBoardSnapshot(
    [{ ...base[0], price: base[0].price + 0.5 }, base[1]],
    ['Café De Dokter']
  );
  assert.notEqual(snap1, editedPrice);

  const editedBars = computeBoardSnapshot(base, ['Café De Dokter', 'De Waagh']);
  assert.notEqual(snap1, editedBars);
});

test('isUntouchedPresetBoard detects unmodified seed vs edited or empty boards', () => {
  assert.equal(isUntouchedPresetBoard(POPULAR_BAR_PRESETS, []), true);
  assert.equal(isUntouchedPresetBoard([], []), false);
  assert.equal(isUntouchedPresetBoard(POPULAR_BAR_PRESETS, ['Custom Bar']), false);

  const modified = POPULAR_BAR_PRESETS.map((d, i) =>
    i === 0 ? { ...d, price: d.price + 1 } : d
  );
  assert.equal(isUntouchedPresetBoard(modified, []), false);
});
