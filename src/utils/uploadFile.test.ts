import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PDF_BYTES,
  classifyUpload,
  estimateBase64Bytes,
  formatFileSize,
} from './uploadFile.ts';

test('classifyUpload accepts JPEG, HEIC, and PDF files', () => {
  assert.deepEqual(classifyUpload({ type: 'image/jpeg', name: 'menu.jpg', size: 450_000 }), {
    kind: 'image',
    mimeType: 'image/jpeg',
    error: null,
  });

  assert.deepEqual(classifyUpload({ type: 'image/jpg', name: 'menu.jpg', size: 450_000 }), {
    kind: 'image',
    mimeType: 'image/jpeg',
    error: null,
  });

  assert.deepEqual(classifyUpload({ type: 'image/heic', name: 'IMG_001.HEIC', size: 2_500_000 }), {
    kind: 'image',
    mimeType: 'image/heic',
    error: null,
  });

  assert.deepEqual(
    classifyUpload({ type: 'application/pdf', name: 'drankkaart.pdf', size: 1_200_000 }),
    {
      kind: 'pdf',
      mimeType: 'application/pdf',
      error: null,
    }
  );
});

test('classifyUpload falls back to extension when file.type is empty (Android pickers)', () => {
  assert.deepEqual(classifyUpload({ type: '', name: 'bierkaart.PDF', size: 900_000 }), {
    kind: 'pdf',
    mimeType: 'application/pdf',
    error: null,
  });

  assert.deepEqual(
    classifyUpload({ type: 'application/octet-stream', name: 'photo.heic', size: 1_000_000 }),
    {
      kind: 'image',
      mimeType: 'image/heic',
      error: null,
    }
  );
});

test('classifyUpload rejects oversized PDFs (> 3 MB) and unsupported file types', () => {
  const largePdf = classifyUpload({
    type: 'application/pdf',
    name: 'huge.pdf',
    size: MAX_PDF_BYTES + 100_000,
  });
  assert.equal(largePdf.kind, null);
  assert.match(largePdf.error || '', /3 MB/);

  const docx = classifyUpload({
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    name: 'menu.docx',
    size: 50_000,
  });
  assert.equal(docx.kind, null);
  assert.match(docx.error || '', /photo.*PDF/i);
});

test('estimateBase64Bytes accurately measures data URL payload bytes', () => {
  // "Hello" (5 bytes) -> base64 "SGVsbG8=" (8 chars, 1 padding)
  assert.equal(estimateBase64Bytes('data:text/plain;base64,SGVsbG8='), 5);
  // "Hi" (2 bytes) -> base64 "SGk=" (4 chars, 1 padding)
  assert.equal(estimateBase64Bytes('data:application/pdf;base64,SGk='), 2);
  // "Man" (3 bytes) -> base64 "TWFu" (4 chars, 0 padding)
  assert.equal(estimateBase64Bytes('TWFu'), 3);
  assert.equal(estimateBase64Bytes(''), 0);
});

test('formatFileSize formats bytes, KB, and MB cleanly', () => {
  assert.equal(formatFileSize(512), '512 B');
  assert.equal(formatFileSize(2048), '2 KB');
  assert.equal(formatFileSize(1.4 * 1024 * 1024), '1.4 MB');
});
