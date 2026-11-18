import test from 'node:test';
import assert from 'node:assert/strict';
import { isChunkLoadError } from './lazyWithRetry.ts';

test('isChunkLoadError identifies dynamic import and chunk load failures across browsers', () => {
  assert.equal(
    isChunkLoadError(new Error('Failed to fetch dynamically imported module: /assets/BarsHub.js')),
    true
  );
  assert.equal(
    isChunkLoadError(new Error('Importing a module script failed.')),
    true
  );
  assert.equal(
    isChunkLoadError(new Error('error loading dynamically imported module')),
    true
  );
  assert.equal(
    isChunkLoadError('ChunkLoadError: Loading chunk 12 failed.'),
    true
  );
  assert.equal(isChunkLoadError(new Error('Network timeout')), false);
  assert.equal(isChunkLoadError(null), false);
});
