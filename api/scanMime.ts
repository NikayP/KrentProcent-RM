export const ALLOWED_SCAN_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
] as const;

export type AllowedScanMimeType = (typeof ALLOWED_SCAN_MIME_TYPES)[number];

const ALLOWED_MIME_SET = new Set<string>(ALLOWED_SCAN_MIME_TYPES);

/**
 * Normalizes and validates an incoming MIME type against the scan whitelist.
 * Returns null if the type is missing or unsupported.
 */
export function normalizeScanMimeType(raw: unknown): AllowedScanMimeType | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().toLowerCase().split(';')[0].trim();
  const mapped = cleaned === 'image/jpg' ? 'image/jpeg' : cleaned;
  return ALLOWED_MIME_SET.has(mapped) ? (mapped as AllowedScanMimeType) : null;
}
