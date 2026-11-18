import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  FileText,
  Check,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Store,
  WifiOff,
} from 'lucide-react';
import {
  DrinkItem,
  DrinkCategory,
  formatCurrency,
  canonicalizeBarName,
  findDuplicateDrinkInBar,
  deduplicateDrinksPerBar,
  calculateDrinkMetrics,
  areBarNamesEquivalent,
  sanitizeDrinkItem,
  isExplicitZeroAlcohol,
} from '../utils/calculator';
import { parseMenuFallback } from '../utils/menuParser';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  MAX_PAYLOAD_BYTES,
  classifyUpload,
  estimateBase64Bytes,
  formatFileSize,
  type UploadKind,
} from '../utils/uploadFile';

/**
 * Resizes and compresses an image client-side to keep the base64 payload
 * well below Vercel's 4.5 MB Serverless Function payload limit (typically ~200-500 KB)
 * while preserving high visual fidelity for Gemini Vision OCR.
 */
// Bounded LRU in-memory cache keyed by image/text fingerprint for 0ms repeat scans
const MAX_SCAN_CACHE_ENTRIES = 10;
const scanResultCache = new Map<string, { detectedBarName?: string; drinks: any[] }>();
let cachedGeminiConfigured: boolean | null = null;

function setScanCacheEntry(key: string, value: { detectedBarName?: string; drinks: any[] }): void {
  if (scanResultCache.has(key)) {
    scanResultCache.delete(key);
  }
  scanResultCache.set(key, value);
  while (scanResultCache.size > MAX_SCAN_CACHE_ENTRIES) {
    const oldestKey = scanResultCache.keys().next().value;
    if (oldestKey === undefined) break;
    scanResultCache.delete(oldestKey);
  }
}

function computeScanCacheKey(imageBase64?: string | null, textInput?: string): string {
  const imgPart = imageBase64
    ? `${imageBase64.length}:${imageBase64.slice(0, 64)}:${imageBase64.slice(-64)}`
    : '';
  const txtPart = (textInput || '').trim();
  return `${imgPart}||${txtPart}`;
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

function canvasToJpegDataUrl(canvas: HTMLCanvasElement, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to encode compressed JPEG'));
            return;
          }
          void readBlobAsDataUrl(blob).then(resolve, reject);
        },
        'image/jpeg',
        quality
      );
      return;
    }
    try {
      resolve(canvas.toDataURL('image/jpeg', quality));
    } catch (err) {
      reject(err);
    }
  });
}

async function loadDrawableImage(
  file: File
): Promise<{ source: CanvasImageSource; width: number; height: number; cleanup: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fall back to ObjectURL + HTMLImageElement (e.g., certain mobile HEIC/EXIF edge cases)
    }
  }

  const objectUrl = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for compression'));
    };
    img.onload = () => {
      resolve({
        source: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        cleanup: () => URL.revokeObjectURL(objectUrl),
      });
    };
    img.src = objectUrl;
  });
}

async function compressImageFile(
  file: File,
  maxDimension = 1280,
  quality = 0.8
): Promise<string> {
  const { source, width: origWidth, height: origHeight, cleanup } = await loadDrawableImage(file);
  try {
    let width = origWidth;
    let height = origHeight;

    // Downscale while maintaining aspect ratio if either dimension exceeds maxDimension
    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return readBlobAsDataUrl(file);
    }

    // Subtle contrast boost sharpens small menu prices for fast Flash-Lite OCR
    try {
      ctx.filter = 'contrast(1.12)';
    } catch {
      // Ignore if browser canvas does not support filter
    }

    ctx.drawImage(source, 0, 0, width, height);
    return await canvasToJpegDataUrl(canvas, quality);
  } finally {
    cleanup();
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return readBlobAsDataUrl(file);
}

interface ScanUpload {
  dataUrl: string;
  mimeType: string;
  kind: UploadKind;
  fileName: string;
  sizeBytes: number;
}

interface MenuScannerProps {
  onImportDrinks: (drinks: DrinkItem[]) => void;
  existingDrinks?: DrinkItem[];
  currency: string;
  activeBar?: string;
  availableBars?: string[];
}

export const MenuScanner: React.FC<MenuScannerProps> = ({
  onImportDrinks,
  existingDrinks = [],
  currency,
  activeBar,
  availableBars = [],
}) => {
  const [targetBar, setTargetBar] = useState<string>(
    activeBar && activeBar !== 'all' ? activeBar : 'De Bruine Kroeg'
  );
  const [upload, setUpload] = useState<ScanUpload | null>(null);
  const [textInput, setTextInput] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const [scannedDrinks, setScannedDrinks] = useState<DrinkItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [mode, setMode] = useState<'photo' | 'text'>('photo');
  const [isGeminiConfigured, setIsGeminiConfigured] = useState<boolean>(
    cachedGeminiConfigured ?? true
  );
  const [preScanStatus, setPreScanStatus] = useState<'idle' | 'running' | 'ready'>('idle');
  const isOnline = useOnlineStatus();

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const inFlightPreScanRef = useRef<{
    key: string;
    promise: Promise<any>;
    controller: AbortController;
  } | null>(null);
  const preScanDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelBackgroundPreScan = () => {
    if (preScanDelayTimerRef.current) {
      clearTimeout(preScanDelayTimerRef.current);
      preScanDelayTimerRef.current = null;
    }
    if (inFlightPreScanRef.current) {
      inFlightPreScanRef.current.controller.abort();
      inFlightPreScanRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      cancelBackgroundPreScan();
    };
  }, []);

  // Speculative background pre-scan: starts after a short 600ms grace delay and aborts cleanly on file change/unmount
  const startBackgroundPreScan = (targetUpload: ScanUpload) => {
    cancelBackgroundPreScan();
    if (!isGeminiConfigured || !isOnline) return;
    if (estimateBase64Bytes(targetUpload.dataUrl) > MAX_PAYLOAD_BYTES) return;
    const cacheKey = computeScanCacheKey(targetUpload.dataUrl, '');
    if (scanResultCache.has(cacheKey)) {
      setPreScanStatus('ready');
      return;
    }

    preScanDelayTimerRef.current = setTimeout(() => {
      preScanDelayTimerRef.current = null;
      const controller = new AbortController();
      setPreScanStatus('running');

      const preScanPromise = (async () => {
        try {
          const response = await fetch('/api/scan-menu', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              imageBase64: targetUpload.dataUrl,
              mimeType: targetUpload.mimeType,
            }),
          });
          if (!response.ok) {
            if (!controller.signal.aborted) setPreScanStatus('idle');
            return null;
          }
          const data = await response.json();
          if (data?.drinks && Array.isArray(data.drinks) && data.drinks.length > 0) {
            setScanCacheEntry(cacheKey, data);
            if (!controller.signal.aborted) setPreScanStatus('ready');
            return data;
          }
          if (!controller.signal.aborted) setPreScanStatus('idle');
          return null;
        } catch {
          if (!controller.signal.aborted) setPreScanStatus('idle');
          return null;
        } finally {
          if (inFlightPreScanRef.current?.key === cacheKey) {
            inFlightPreScanRef.current = null;
          }
        }
      })();

      inFlightPreScanRef.current = { key: cacheKey, promise: preScanPromise, controller };
    }, 600);
  };

  useEffect(() => {
    if (cachedGeminiConfigured !== null) return;
    const controller = new AbortController();
    fetch('/api/config', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (cfg && typeof cfg.geminiConfigured === 'boolean') {
          cachedGeminiConfigured = cfg.geminiConfigured;
          setIsGeminiConfigured(cfg.geminiConfigured);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (activeBar && activeBar !== 'all') {
      setTargetBar(activeBar);
    }
  }, [activeBar]);

  const clearSelectedFile = () => {
    cancelBackgroundPreScan();
    setUpload(null);
    setPreScanStatus('idle');
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (uploadInputRef.current) uploadInputRef.current.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const classified = classifyUpload(file);
    if (classified.error || !classified.kind) {
      setErrorMessage(classified.error || 'Please choose a photo or PDF menu.');
      e.target.value = '';
      return;
    }

    setErrorMessage(null);
    setSuccessNote(null);
    setPreScanStatus('idle');
    setIsProcessingImage(true);

    try {
      let nextUpload: ScanUpload;
      if (classified.kind === 'pdf') {
        const dataUrl = await readFileAsDataUrl(file);
        nextUpload = {
          dataUrl,
          mimeType: 'application/pdf',
          kind: 'pdf',
          fileName: file.name,
          sizeBytes: file.size,
        };
      } else {
        try {
          const compressedDataUrl = await compressImageFile(file, 1280, 0.8);
          nextUpload = {
            dataUrl: compressedDataUrl,
            mimeType: 'image/jpeg',
            kind: 'image',
            fileName: file.name,
            sizeBytes: file.size,
          };
        } catch (err: any) {
          console.warn('Image compression fallback to raw data URL:', err);
          const rawUrl = await readFileAsDataUrl(file);
          nextUpload = {
            dataUrl: rawUrl,
            mimeType: classified.mimeType,
            kind: 'image',
            fileName: file.name,
            sizeBytes: file.size,
          };
        }
      }

      setUpload(nextUpload);
      if (estimateBase64Bytes(nextUpload.dataUrl) > MAX_PAYLOAD_BYTES) {
        setErrorMessage(
          nextUpload.kind === 'pdf'
            ? 'PDF is larger than 3 MB — screenshot the drinks page or use a smaller PDF.'
            : 'The image is too large for the scanning service (> 4.2 MB). Please take a closer photo or crop the image.'
        );
      } else {
        startBackgroundPreScan(nextUpload);
      }
    } catch {
      setErrorMessage('Could not read the selected file. Please try again.');
      e.target.value = '';
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleScan = async (overrideText?: string, overrideBarName?: string) => {
    const textToSend = overrideText !== undefined ? overrideText : textInput;
    const barToUse = overrideBarName !== undefined ? overrideBarName : targetBar;

    if (!upload && !textToSend.trim()) {
      setErrorMessage('Please upload a menu photo or PDF, or enter text to scan.');
      return;
    }

    // Safety check: ensure payload stays well below Vercel's 4.5 MB platform limit
    if (upload && estimateBase64Bytes(upload.dataUrl) > MAX_PAYLOAD_BYTES) {
      setErrorMessage(
        upload.kind === 'pdf'
          ? 'PDF is larger than 3 MB — screenshot the drinks page or use a smaller PDF.'
          : 'The image is too large for the scanning service (> 4.2 MB). Please take a closer photo or crop the image.'
      );
      return;
    }

    setIsScanning(true);
    setErrorMessage(null);
    setSuccessNote(null);
    const clientStartTime = performance.now();

    try {
      const cacheKey = computeScanCacheKey(upload?.dataUrl, textToSend);
      const fileOnlyKey = computeScanCacheKey(upload?.dataUrl, '');
      const cached =
        scanResultCache.get(cacheKey) ||
        (!textToSend.trim() && upload ? scanResultCache.get(fileOnlyKey) : undefined);
      let data: any = null;
      let joinedPreScan = false;

      if (preScanDelayTimerRef.current) {
        clearTimeout(preScanDelayTimerRef.current);
        preScanDelayTimerRef.current = null;
      }

      if (cached) {
        data = cached;
      } else if (
        !textToSend.trim() &&
        upload &&
        inFlightPreScanRef.current?.key === fileOnlyKey
      ) {
        // Join the speculative background pre-scan that started when the file was selected!
        const preScannedData = await inFlightPreScanRef.current.promise;
        if (preScannedData && Array.isArray(preScannedData.drinks) && preScannedData.drinks.length > 0) {
          data = preScannedData;
          joinedPreScan = true;
        }
      }

      if (!data && !upload && textToSend.trim()) {
        // Parse menu text locally in-browser so text scanning is instant and works offline
        const localParsed = parseMenuFallback(textToSend, barToUse);
        if (localParsed.drinks.length > 0) {
          data = localParsed;
        } else if (!isOnline) {
          throw new Error(
            'Could not detect priced drinks in the pasted text. Try lines like "Heineken 25cl 5% €3.60".'
          );
        }
      }

      if (!data) {
        if (!isOnline) {
          throw new Error(
            'You are currently offline. AI menu scanning requires an internet connection — switch to "Paste Menu Text" to parse menus offline.'
          );
        }

        const response = await fetch('/api/scan-menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: upload?.dataUrl || undefined,
            mimeType: upload?.mimeType || 'image/jpeg',
            textInput: textToSend || undefined,
            barName: barToUse.trim() || undefined,
          }),
        });

        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
          try {
            data = await response.json();
          } catch (jsonErr: any) {
            throw new Error(`Invalid JSON received from server: ${jsonErr.message}`);
          }
        } else {
          const textResponse = await response.text();
          throw new Error(
            `Server returned an unexpected response (${response.status} ${response.statusText}): ${textResponse.slice(0, 150)}...`
          );
        }

        if (!response.ok) {
          const details = data?.details ? ` (${data.details})` : '';
          throw new Error(`${data?.error || `Failed to scan menu (${response.status})`}${details}`);
        }

        if (data?.drinks && Array.isArray(data.drinks) && data.drinks.length > 0) {
          setScanCacheEntry(cacheKey, data);
        }
      }

      const elapsedSec = ((performance.now() - clientStartTime) / 1000).toFixed(1);

      // Canonicalize targetBar with existing bars
      const canonicalTarget = canonicalizeBarName(
        barToUse.trim() || data.detectedBarName || 'Current Bar',
        availableBars
      );

      setTargetBar(canonicalTarget);

      if (data.drinks && Array.isArray(data.drinks) && data.drinks.length > 0) {
        const rawFormatted: DrinkItem[] = data.drinks.map((d: any, idx: number) => {
          const rawName = d.name || `Scanned Drink #${idx + 1}`;
          const parsedAbv = Number(d.abv);
          const safeAbv = isExplicitZeroAlcohol(rawName)
            ? 0
            : Number.isFinite(parsedAbv) && parsedAbv >= 0
              ? parsedAbv
              : 5.0;

          return sanitizeDrinkItem({
            id: `scanned-${Date.now()}-${idx}`,
            name: rawName,
            barName: canonicalTarget,
            category: (d.category as DrinkCategory) || 'beer',
            volumeMl: Number(d.volumeMl) || 330,
            abv: safeAbv,
            price: Number(d.price) || 5.0,
            notes: d.notes || 'Scanned from menu',
          });
        });

        // Deduplicate within the scan batch itself
        const { drinks: formatted, duplicatesRemoved } = deduplicateDrinksPerBar(
          rawFormatted,
          'first'
        );

        // Pre-select only non-exact-duplicates for this bar
        const defaultSelected = new Set<string>();
        let exactDupCount = 0;
        for (const item of formatted) {
          const dup = findDuplicateDrinkInBar(existingDrinks, item);
          if (dup && dup.matchType === 'exact') {
            exactDupCount++;
          } else {
            defaultSelected.add(item.id);
          }
        }

        setScannedDrinks(formatted);
        setSelectedIds(defaultSelected);

        const extraNotes: string[] = [];
        extraNotes.push(
          cached
            ? 'instant from pre-scan/cache'
            : joinedPreScan
              ? `in ${elapsedSec}s via Turbo Pre-Scan`
              : `in ${elapsedSec}s`
        );
        if (duplicatesRemoved > 0) {
          extraNotes.push(`${duplicatesRemoved} duplicate line(s) merged`);
        }
        if (exactDupCount > 0) {
          extraNotes.push(`${exactDupCount} already in "${canonicalTarget}" unchecked`);
        }

        setSuccessNote(
          `Detected ${formatted.length} drinks for "${canonicalTarget}" (${extraNotes.join(', ')})! Review and import below.`
        );
      } else {
        setErrorMessage(
          'Could not detect any alcoholic drinks from the menu. Try a clearer image or use the text parser.'
        );
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error communicating with scanning service.');
    } finally {
      setIsScanning(false);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === scannedDrinks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(scannedDrinks.map((d) => d.id)));
    }
  };

  const handleUpdateScannedItem = (id: string, field: keyof DrinkItem, value: any) => {
    setScannedDrinks((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleTargetBarChange = (newBarValue: string) => {
    setTargetBar(newBarValue);
    // Keep scanned items' barName synced to targetBar
    setScannedDrinks((prev) => prev.map((item) => ({ ...item, barName: newBarValue })));
  };

  // Compute duplicate statuses for each scanned drink against existingDrinks
  const duplicateStatuses = useMemo(() => {
    const map = new Map<string, ReturnType<typeof findDuplicateDrinkInBar>>();
    const canonicalTarget = canonicalizeBarName(targetBar.trim(), availableBars);
    for (const d of scannedDrinks) {
      const dup = findDuplicateDrinkInBar(existingDrinks, {
        name: d.name,
        barName: d.barName || canonicalTarget,
        volumeMl: d.volumeMl,
        abv: d.abv,
        price: d.price,
      });
      map.set(d.id, dup);
    }
    return map;
  }, [scannedDrinks, existingDrinks, targetBar, availableBars]);

  const handleImport = () => {
    const canonicalTarget = canonicalizeBarName(targetBar.trim(), availableBars);
    const toImport = scannedDrinks
      .filter((d) => selectedIds.has(d.id))
      .map((d) => ({
        ...d,
        barName: canonicalizeBarName(d.barName || canonicalTarget, availableBars),
      }));

    if (toImport.length === 0) {
      setErrorMessage('Please select at least one drink to import.');
      return;
    }
    onImportDrinks(toImport);
    setSuccessNote(`Imported ${toImport.length} drinks for ${canonicalTarget}!`);
    setScannedDrinks([]);
    clearSelectedFile();
    setTextInput('');
  };

  return (
    <div className="bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl p-4 sm:p-6 shadow-sm space-y-6">
      {/* Header */}
      <div id="tour-scanner-sample">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-xl bg-[#FF8A8E]/20 text-[#F21B2D]">
            <Camera className="w-5 h-5" />
          </span>
          <h2 className="text-lg font-extrabold tracking-[-0.03em] text-[#18181B] dark:text-[#FFFFFF]">Menu Photo &amp; PDF Scanner</h2>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Snap a photo of the pub chalkboard, upload a screenshot, or pick a PDF drinks menu. Our
          AI extracts volume, ABV, and price and checks for duplicates at this bar!
        </p>
      </div>

      {/* Target Bar Selector */}
      <div className="bg-[#FFF2F3]/60 dark:bg-[#121214] p-3.5 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] space-y-2">
        <label
          htmlFor="scanner-bar-input"
          className="text-xs font-bold text-[#F21B2D] uppercase tracking-wider flex items-center gap-1.5"
        >
          <Store className="w-4 h-4 text-[#F21B2D]" />
          <span>Which Bar / Pub is this menu from?</span>
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="scanner-bar-input"
            list="scanner-bars-datalist"
            type="text"
            value={targetBar}
            onChange={(e) => handleTargetBarChange(e.target.value)}
            placeholder="e.g. De Bruine Kroeg, Café Gollem, The Waterhole..."
            className="flex-1 bg-[#FFFFFF] dark:bg-[#18181B] text-[#18181B] dark:text-[#FFFFFF] font-medium text-xs sm:text-sm rounded-xl px-3 py-2 border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D]"
          />
          <datalist id="scanner-bars-datalist">
            {availableBars.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
          {availableBars.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {availableBars.slice(0, 4).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => handleTargetBarChange(b)}
                  className={`text-[11px] px-2.5 py-1.5 rounded-xl border whitespace-nowrap font-semibold transition-colors ${
                    areBarNamesEquivalent(targetBar, b)
                      ? 'bg-[#F21B2D] hover:bg-[#D91424] text-white border-[#F21B2D]'
                      : 'bg-[#FFFFFF] dark:bg-[#18181B] text-zinc-600 dark:text-zinc-400 border-[#E4E4E7] dark:border-[#27272A] hover:text-[#18181B] dark:hover:text-white'
                  }`}
                >
                  {b}
                </button>
              ))}
              {availableBars.length > 4 && (
                <select
                  value={
                    availableBars.find((b) => areBarNamesEquivalent(targetBar, b)) || ''
                  }
                  onChange={(e) => {
                    if (e.target.value) handleTargetBarChange(e.target.value);
                  }}
                  aria-label="Select known bar"
                  className="text-[11px] px-2.5 py-1.5 rounded-xl bg-[#FFFFFF] dark:bg-[#18181B] text-[#F21B2D] border border-[#E4E4E7] dark:border-[#27272A] font-semibold focus:outline-none focus:border-[#F21B2D]"
                >
                  <option value="">+{availableBars.length - 4} more...</option>
                  {availableBars.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mode Switcher: Photo or Text */}
      <div className="flex items-center gap-2 border-b border-[#E4E4E7] dark:border-[#27272A] pb-3">
        <button
          type="button"
          onClick={() => setMode('photo')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            mode === 'photo'
              ? 'bg-[#F21B2D] hover:bg-[#D91424] text-white font-bold shadow-sm'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-[#18181B] dark:hover:text-white hover:bg-[#FFF2F3] dark:hover:bg-[#121214]'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Photo / PDF</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('text')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            mode === 'text'
              ? 'bg-[#F21B2D] hover:bg-[#D91424] text-white font-bold shadow-sm'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-[#18181B] dark:hover:text-white hover:bg-[#FFF2F3] dark:hover:bg-[#121214]'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Paste Menu Text</span>
        </button>
      </div>

      {/* Input Areas */}
      {mode === 'photo' ? (
        <div className="space-y-4">
          {!isOnline && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/35 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
              <WifiOff className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-[#18181B] dark:text-[#FFFFFF]">
                  You&apos;re Offline — Photo Scanning Unavailable
                </p>
                <p className="text-zinc-600 dark:text-zinc-300">
                  AI photo recognition needs an internet connection. You can still use{' '}
                  <button
                    type="button"
                    onClick={() => setMode('text')}
                    className="font-bold underline text-[#F21B2D]"
                  >
                    Paste Menu Text
                  </button>{' '}
                  offline!
                </p>
              </div>
            </div>
          )}

          {isOnline && !isGeminiConfigured && (
            <div className="p-3.5 rounded-xl bg-[#FF8A8E]/15 border border-[#FF8A8E]/40 text-[#D91424] dark:text-[#FF8A8E] text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#F21B2D] mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-[#18181B] dark:text-[#FFFFFF]">Gemini API Key Required for Image Scanning</p>
                <p className="text-zinc-600 dark:text-zinc-300">
                  AI vision menu extraction requires <code className="text-[#D91424] dark:text-[#FF8A8E] bg-[#FFFFFF] dark:bg-[#121214] px-1 py-0.5 rounded border border-[#E4E4E7] dark:border-[#27272A]">GEMINI_API_KEY</code> in your <code className="text-[#D91424] dark:text-[#FF8A8E] bg-[#FFFFFF] dark:bg-[#121214] px-1 py-0.5 rounded border border-[#E4E4E7] dark:border-[#27272A]">.env</code> file. Without it, you can use the <strong>Paste Menu Text</strong> tab to parse menus locally without an API key!
                </p>
              </div>
            </div>
          )}

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*,application/pdf,.pdf"
            onChange={handleFileChange}
            className="hidden"
          />

          {!upload ? (
            <div className="space-y-3">
              <button
                type="button"
                disabled={isProcessingImage}
                onClick={() => cameraInputRef.current?.click()}
                className={`w-full border-2 border-dashed border-[#E4E4E7] dark:border-[#27272A] hover:border-[#F21B2D] rounded-2xl p-8 text-center cursor-pointer transition-colors bg-[#FFF2F3]/50 dark:bg-[#121214] hover:bg-[#FFF2F3] dark:hover:bg-[#18181B] group ${
                  isProcessingImage ? 'opacity-60 cursor-wait' : ''
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-[#FFFFFF] dark:bg-[#18181B] group-hover:bg-[#FF8A8E]/20 text-zinc-400 group-hover:text-[#F21B2D] flex items-center justify-center mx-auto mb-3 transition-colors border border-[#E4E4E7] dark:border-[#27272A]">
                  {isProcessingImage ? (
                    <RefreshCw className="w-6 h-6 animate-spin text-[#F21B2D]" />
                  ) : (
                    <Camera className="w-6 h-6" />
                  )}
                </div>
                <h4 className="text-sm font-bold text-[#18181B] dark:text-[#FFFFFF] mb-1">
                  {isProcessingImage ? 'Preparing File...' : 'Take Photo'}
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                  {isProcessingImage
                    ? 'Preparing menu for fast and sharp AI scanning...'
                    : 'Snap the menu or chalkboard with your camera.'}
                </p>
              </button>

              <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  disabled={isProcessingImage}
                  onClick={() => uploadInputRef.current?.click()}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#FFFFFF] dark:bg-[#18181B] hover:bg-[#FFF2F3] dark:hover:bg-[#27272A] text-[#18181B] dark:text-zinc-200 border border-[#E4E4E7] dark:border-[#27272A] hover:border-[#F21B2D]/60 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Upload className="w-4 h-4 text-[#F21B2D]" />
                  <span>Upload Photo or PDF</span>
                </button>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 text-center">
                  JPG, PNG, WebP, HEIC or PDF (max 3 MB).
                </p>
              </div>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden border border-[#E4E4E7] dark:border-[#27272A] bg-[#FFF2F3]/40 dark:bg-[#121214] min-h-[140px] max-h-80 flex items-center justify-center">
              {upload.kind === 'pdf' ? (
                <div className="flex items-center gap-3.5 px-5 py-8 pr-28 max-w-full">
                  <div className="w-12 h-12 rounded-2xl bg-[#F21B2D]/10 text-[#F21B2D] border border-[#F21B2D]/25 flex items-center justify-center shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[#18181B] dark:text-[#FFFFFF] truncate max-w-[220px] sm:max-w-xs">
                      {upload.fileName}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 tabular-nums">
                      PDF menu &bull; {formatFileSize(upload.sizeBytes)}
                    </div>
                  </div>
                </div>
              ) : (
                <img
                  src={upload.dataUrl}
                  alt="Menu preview"
                  className="max-h-80 w-auto object-contain"
                />
              )}
              {preScanStatus === 'running' && (
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-xl bg-[#FFFFFF]/95 dark:bg-[#18181B]/95 text-[#D91424] dark:text-[#FF8A8E] text-[11px] font-semibold border border-[#FF8A8E]/40 flex items-center gap-1.5 shadow-sm">
                  <RefreshCw className="w-3 h-3 animate-spin text-[#F21B2D]" />
                  <span>Turbo Pre-Scan active...</span>
                </div>
              )}
              {preScanStatus === 'ready' && (
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-xl bg-[#FFFFFF]/95 dark:bg-[#18181B]/95 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span>Pre-Scanned — Instant Extract!</span>
                </div>
              )}
              <button
                type="button"
                onClick={clearSelectedFile}
                className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-[#FFFFFF]/95 dark:bg-[#18181B]/95 text-[#18181B] dark:text-zinc-200 text-xs font-semibold border border-[#E4E4E7] dark:border-[#27272A] hover:bg-[#FFF2F3] dark:hover:bg-[#27272A] shadow-sm"
              >
                Change File
              </button>
            </div>
          )}

          {upload && (
            <button
              type="button"
              onClick={() => handleScan()}
              disabled={isScanning || isProcessingImage || !isOnline}
              className="w-full py-3 rounded-xl bg-[#F21B2D] hover:bg-[#D91424] text-white font-extrabold tracking-[-0.01em] text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
            >
              {isScanning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>
                    {upload.kind === 'pdf'
                      ? 'Analyzing PDF Menu with Gemini AI...'
                      : 'Analyzing Drink Menu with Gemini AI...'}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Scan &amp; Extract All Drinks for {targetBar}</span>
                </>
              )}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <label htmlFor="menu-text-area" className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            Paste Menu Text / Tap List:
          </label>
          <textarea
            id="menu-text-area"
            rows={5}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={`Example:\nHeineken Vaasje 25cl 5% €3.60\nTripel Karmeliet 33cl 8.4% €5.90\nGuinness Pint 50cl €6.80`}
            className="w-full bg-[#FFF2F3]/50 dark:bg-[#121214] text-[#18181B] dark:text-[#FFFFFF] rounded-xl p-3 text-xs sm:text-sm font-mono border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D] placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
          />

          <button
            type="button"
            onClick={() => handleScan()}
            disabled={isScanning || !textInput.trim()}
            className="w-full py-3 rounded-xl bg-[#F21B2D] hover:bg-[#D91424] text-white font-extrabold tracking-[-0.01em] text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            {isScanning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Extracting Drinks...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Parse Menu Text for {targetBar}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Messages */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-[#F21B2D]/10 border border-[#F21B2D]/40 text-[#D91424] dark:text-[#FF8A8E] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-start sm:items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#F21B2D] mt-0.5 sm:mt-0" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
          {upload && (
            <button
              type="button"
              onClick={() => handleScan()}
              disabled={isScanning}
              className="px-3 py-1.5 rounded-xl bg-[#F21B2D] hover:bg-[#D91424] text-white font-bold text-xs flex items-center gap-1.5 self-start sm:self-auto shrink-0 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>Retry Scan</span>
            </button>
          )}
        </div>
      )}

      {successNote && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{successNote}</span>
        </div>
      )}

      {/* Extracted Drinks Review Table */}
      {scannedDrinks.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-[#E4E4E7] dark:border-[#27272A]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold tracking-[-0.02em] text-[#18181B] dark:text-[#FFFFFF] flex items-center gap-2">
                <span>Detected Drinks for {targetBar}</span>
                <span className="text-xs bg-[#FF8A8E]/20 text-[#D91424] dark:text-[#FF8A8E] px-2 py-0.5 rounded-full border border-[#FF8A8E]/40 tabular-nums font-bold whitespace-nowrap shrink-0">
                  {scannedDrinks.length} found
                </span>
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Adjust any details before importing. Existing duplicates in {targetBar} are
                automatically flagged.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-[#F21B2D] underline"
              >
                {selectedIds.size === scannedDrinks.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#E4E4E7] dark:border-[#27272A] bg-[#FFF2F3]/30 dark:bg-[#121214] pb-1">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="bg-[#FFF2F3] dark:bg-[#18181B] text-zinc-500 dark:text-zinc-400 uppercase font-semibold text-[10px] tracking-wider border-b border-[#E4E4E7] dark:border-[#27272A]">
                <tr>
                  <th className="p-2.5 w-8 text-center">Inc</th>
                  <th className="p-2.5">Drink Name</th>
                  <th className="p-2.5 w-28">Status in Bar</th>
                  <th className="p-2.5 w-20">Vol (ml)</th>
                  <th className="p-2.5 w-20">ABV (%)</th>
                  <th className="p-2.5 w-24">Price ({currency})</th>
                  <th className="p-2.5 w-24 text-right">Krent Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E4E7] dark:divide-[#27272A]">
                {scannedDrinks.map((drink) => {
                  const isChecked = selectedIds.has(drink.id);
                  const dup = duplicateStatuses.get(drink.id);
                  const metrics = calculateDrinkMetrics(drink);

                  return (
                    <tr
                      key={drink.id}
                      className={`hover:bg-[#FFF2F3]/60 dark:hover:bg-[#18181B] transition-colors ${
                        isChecked ? 'bg-[#FF8A8E]/10' : 'opacity-60'
                      }`}
                    >
                      <td className="p-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(drink.id)}
                          className="rounded border-[#E4E4E7] dark:border-[#27272A] accent-[#F21B2D] h-4 w-4"
                        />
                      </td>

                      <td className="p-2.5">
                        <input
                          type="text"
                          value={drink.name}
                          onChange={(e) =>
                            handleUpdateScannedItem(drink.id, 'name', e.target.value)
                          }
                          className="w-full bg-[#FFFFFF] dark:bg-[#18181B] text-[#18181B] dark:text-[#FFFFFF] rounded-lg px-2 py-1 text-xs border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D] font-medium"
                        />
                      </td>

                      <td className="p-2.5">
                        {!dup ? (
                          <span className="inline-block whitespace-nowrap text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                            New in bar
                          </span>
                        ) : dup.matchType === 'exact' ? (
                          <span
                            title="Exact same drink, volume, ABV, and price already in this bar"
                            className="inline-block whitespace-nowrap text-[10px] font-bold bg-zinc-200/70 dark:bg-[#27272A] text-zinc-600 dark:text-zinc-400 border border-[#E4E4E7] dark:border-[#27272A] px-2 py-0.5 rounded-full"
                          >
                            Exact duplicate
                          </span>
                        ) : dup.matchType === 'same_variant' ? (
                          <span
                            title={`Currently ${formatCurrency(dup.existingDrink.price, currency)} at this bar — importing will update it`}
                            className="inline-block whitespace-nowrap text-[10px] font-bold bg-[#FF8A8E]/25 text-[#D91424] dark:text-[#FF8A8E] border border-[#FF8A8E]/50 px-2 py-0.5 rounded-full"
                          >
                            Updates price
                          </span>
                        ) : (
                          <span
                            title={`Exists at ${dup.existingDrink.volumeMl}ml in this bar`}
                            className="inline-block whitespace-nowrap text-[10px] font-bold bg-[#FF8A8E]/15 text-[#D91424] dark:text-[#FF8A8E] border border-[#FF8A8E]/40 px-2 py-0.5 rounded-full"
                          >
                            New size ({drink.volumeMl}ml)
                          </span>
                        )}
                      </td>

                      <td className="p-2.5">
                        <input
                          type="number"
                          value={drink.volumeMl}
                          onChange={(e) =>
                            handleUpdateScannedItem(
                              drink.id,
                              'volumeMl',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full bg-[#FFFFFF] dark:bg-[#18181B] text-[#18181B] dark:text-[#FFFFFF] tabular-nums font-medium rounded-lg px-2 py-1 text-xs border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D]"
                        />
                      </td>

                      <td className="p-2.5">
                        <input
                          type="number"
                          step="0.1"
                          value={drink.abv}
                          onChange={(e) =>
                            handleUpdateScannedItem(
                              drink.id,
                              'abv',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full bg-[#FFFFFF] dark:bg-[#18181B] text-[#18181B] dark:text-[#FFFFFF] tabular-nums font-medium rounded-lg px-2 py-1 text-xs border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D]"
                        />
                      </td>

                      <td className="p-2.5">
                        <input
                          type="number"
                          step="0.05"
                          value={drink.price}
                          onChange={(e) =>
                            handleUpdateScannedItem(
                              drink.id,
                              'price',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full bg-[#FFFFFF] dark:bg-[#18181B] text-[#18181B] dark:text-[#FFFFFF] tabular-nums font-medium rounded-lg px-2 py-1 text-xs border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D]"
                        />
                      </td>

                      <td className="p-2.5 text-right font-bold text-[#F21B2D] tabular-nums">
                        {metrics.pureAlcoholPerCurrency} ml/{currency}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Import Button */}
          <button
            type="button"
            onClick={handleImport}
            disabled={selectedIds.size === 0}
            className="w-full py-3 rounded-xl bg-[#F21B2D] hover:bg-[#D91424] text-white font-extrabold tracking-[-0.01em] text-sm flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-40"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>
              Import / Update {selectedIds.size} Drinks for {targetBar}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
