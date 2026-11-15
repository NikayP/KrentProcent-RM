export const MAX_PDF_BYTES = 3 * 1024 * 1024; // 3 MB raw PDF -> ~4 MB base64 (under Vercel 4.5 MB limit)
export const MAX_PAYLOAD_BYTES = 4.2 * 1024 * 1024;

export type UploadKind = 'image' | 'pdf';

export interface UploadClassification {
  kind: UploadKind | null;
  mimeType: string;
  error: string | null;
}

const IMAGE_EXTENSION_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
};

function getLowerExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0) return '';
  return fileName.slice(dot).toLowerCase();
}

export function classifyUpload(file: {
  type: string;
  name: string;
  size: number;
}): UploadClassification {
  const rawType = (file.type || '').trim().toLowerCase().split(';')[0];
  const ext = getLowerExtension(file.name || '');

  const isPdf =
    rawType === 'application/pdf' ||
    rawType === 'application/x-pdf' ||
    ((rawType === '' || rawType === 'application/octet-stream') && ext === '.pdf');

  if (isPdf) {
    if (file.size > MAX_PDF_BYTES) {
      return {
        kind: null,
        mimeType: 'application/pdf',
        error: 'PDF is larger than 3 MB — screenshot the drinks page or use a smaller PDF.',
      };
    }
    return {
      kind: 'pdf',
      mimeType: 'application/pdf',
      error: null,
    };
  }

  if (rawType.startsWith('image/')) {
    const normalizedMime = rawType === 'image/jpg' ? 'image/jpeg' : rawType;
    return {
      kind: 'image',
      mimeType: normalizedMime,
      error: null,
    };
  }

  if ((rawType === '' || rawType === 'application/octet-stream') && ext in IMAGE_EXTENSION_TO_MIME) {
    return {
      kind: 'image',
      mimeType: IMAGE_EXTENSION_TO_MIME[ext],
      error: null,
    };
  }

  return {
    kind: null,
    mimeType: '',
    error: 'Please choose a photo (JPG, PNG, WebP, HEIC) or a PDF menu.',
  };
}

export function estimateBase64Bytes(dataUrl: string): number {
  if (!dataUrl) return 0;
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const len = base64.length;
  if (len === 0) return 0;
  let padding = 0;
  if (base64.endsWith('==')) padding = 2;
  else if (base64.endsWith('=')) padding = 1;
  return Math.max(0, Math.floor((len * 3) / 4) - padding);
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
