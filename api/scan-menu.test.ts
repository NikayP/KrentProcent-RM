import test from 'node:test';
import assert from 'node:assert/strict';
import { ALLOWED_SCAN_MIME_TYPES, normalizeScanMimeType } from './scanMime.ts';

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
