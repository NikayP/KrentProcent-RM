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
} from '../utils/calculator';
import { SAMPLE_MENU_TEXT, SAMPLE_OPERA_MENU_TEXT } from '../presets/barData';

/**
 * Resizes and compresses an image client-side to keep the base64 payload
 * well below Vercel's 4.5 MB Serverless Function payload limit (typically ~200-500 KB)
 * while preserving high visual fidelity for Gemini Vision OCR.
 */
function compressImageFile(file: File, maxDimension = 1600, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

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
          // If canvas context fails, fall back to original dataUrl
          resolve(dataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG with optimal compression
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
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
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [textInput, setTextInput] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const [scannedDrinks, setScannedDrinks] = useState<DrinkItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [mode, setMode] = useState<'photo' | 'text'>('photo');
  const [isGeminiConfigured, setIsGeminiConfigured] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (cfg && typeof cfg.geminiConfigured === 'boolean') {
          setIsGeminiConfigured(cfg.geminiConfigured);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeBar && activeBar !== 'all') {
      setTargetBar(activeBar);
    }
  }, [activeBar]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (PNG, JPG, WebP).');
      return;
    }

    setErrorMessage(null);
    setIsProcessingImage(true);

    try {
      const compressedDataUrl = await compressImageFile(file, 1600, 0.82);
      setImagePreview(compressedDataUrl);
    } catch (err: any) {
      console.warn('Image compression fallback to raw data URL:', err);
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleScan = async (overrideText?: string, overrideBarName?: string) => {
    const textToSend = overrideText !== undefined ? overrideText : textInput;
    const barToUse = overrideBarName !== undefined ? overrideBarName : targetBar;

    if (!imagePreview && !textToSend.trim()) {
      setErrorMessage('Please upload a menu image or enter text to scan.');
      return;
    }

    // Safety check: ensure payload stays well below Vercel's 4.5 MB platform limit
    if (imagePreview) {
      const approxBytes = (imagePreview.length * 3) / 4;
      if (approxBytes > 4.2 * 1024 * 1024) {
        setErrorMessage(
          'The image is too large for the scanning service (> 4.2 MB). Please take a closer photo or crop the image.'
        );
        return;
      }
    }

    setIsScanning(true);
    setErrorMessage(null);
    setSuccessNote(null);

    try {
      const response = await fetch('/api/scan-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imagePreview || undefined,
          mimeType: 'image/jpeg',
          textInput: textToSend || undefined,
          barName: barToUse.trim() || undefined,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      let data: any = null;

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

      // Canonicalize targetBar with existing bars
      const canonicalTarget = canonicalizeBarName(
        barToUse.trim() || data.detectedBarName || 'Current Bar',
        availableBars
      );

      setTargetBar(canonicalTarget);

      if (data.drinks && Array.isArray(data.drinks) && data.drinks.length > 0) {
        const rawFormatted: DrinkItem[] = data.drinks.map((d: any, idx: number) => ({
          id: `scanned-${Date.now()}-${idx}`,
          name: d.name || `Scanned Drink #${idx + 1}`,
          barName: canonicalTarget,
          category: (d.category as DrinkCategory) || 'beer',
          volumeMl: Number(d.volumeMl) || 330,
          abv: Number(d.abv) || 5.0,
          price: Number(d.price) || 5.0,
          notes: d.notes || 'Scanned from menu',
        }));

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
        if (duplicatesRemoved > 0) {
          extraNotes.push(`${duplicatesRemoved} duplicate line(s) merged`);
        }
        if (exactDupCount > 0) {
          extraNotes.push(`${exactDupCount} already in "${canonicalTarget}" unchecked`);
        }

        setSuccessNote(
          `Detected ${formatted.length} drinks for "${canonicalTarget}"${
            extraNotes.length > 0 ? ` (${extraNotes.join(', ')})` : ''
          }! Review and import below.`
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

  const handleLoadSample = () => {
    const sampleBar = canonicalizeBarName('De Bruine Kroeg', availableBars);
    setTargetBar(sampleBar);
    setTextInput(SAMPLE_MENU_TEXT);
    setMode('text');
    handleScan(SAMPLE_MENU_TEXT, sampleBar);
  };

  const handleLoadOperaSample = () => {
    const operaBar = canonicalizeBarName('Café de Opera', availableBars);
    setTargetBar(operaBar);
    setTextInput(SAMPLE_OPERA_MENU_TEXT);
    setMode('text');
    handleScan(SAMPLE_OPERA_MENU_TEXT, operaBar);
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
    setImagePreview(null);
    setTextInput('');
  };

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
              <Camera className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-black text-white">Menu Photo &amp; Screenshot Scanner</h2>
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Snap a photo of the pub chalkboard, tap list, or drinks card. Our AI extracts volume,
            ABV, and price and checks for existing duplicates at this bar!
          </p>
        </div>

        {/* 1-Click Sample Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleLoadOperaSample}
            disabled={isScanning}
            className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/50 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Try Sample Café de Opera Menu</span>
          </button>

          <button
            type="button"
            onClick={handleLoadSample}
            disabled={isScanning}
            className="px-3 py-2 rounded-xl bg-stone-850 hover:bg-stone-800 text-stone-300 border border-stone-750 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4 text-stone-400" />
            <span>De Bruine Kroeg</span>
          </button>
        </div>
      </div>

      {/* Target Bar Selector */}
      <div className="bg-stone-950/80 p-3.5 rounded-xl border border-stone-800 space-y-2">
        <label
          htmlFor="scanner-bar-input"
          className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5"
        >
          <Store className="w-4 h-4 text-amber-400" />
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
            className="flex-1 bg-stone-900 text-white font-medium text-xs sm:text-sm rounded-lg px-3 py-2 border border-stone-700 focus:outline-none focus:border-amber-400"
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
                  className={`text-[11px] px-2.5 py-1.5 rounded-lg border whitespace-nowrap font-semibold transition-colors ${
                    areBarNamesEquivalent(targetBar, b)
                      ? 'bg-amber-500/20 text-amber-300 border-amber-400/50'
                      : 'bg-stone-900 text-stone-400 border-stone-800 hover:text-stone-200'
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
                  className="text-[11px] px-2.5 py-1.5 rounded-lg bg-stone-900 text-amber-300 border border-stone-700 font-semibold focus:outline-none focus:border-amber-400"
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
      <div className="flex items-center gap-2 border-b border-stone-800 pb-3">
        <button
          type="button"
          onClick={() => setMode('photo')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            mode === 'photo'
              ? 'bg-amber-500 text-stone-950 font-bold'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Photo / Screenshot</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('text')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            mode === 'text'
              ? 'bg-amber-500 text-stone-950 font-bold'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Paste Menu Text</span>
        </button>
      </div>

      {/* Input Areas */}
      {mode === 'photo' ? (
        <div className="space-y-4">
          {!isGeminiConfigured && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-white">Gemini API Key Required for Image Scanning</p>
                <p className="text-stone-300">
                  AI vision menu extraction requires <code className="text-amber-300 bg-stone-900 px-1 py-0.5 rounded">GEMINI_API_KEY</code> in your <code className="text-amber-300 bg-stone-900 px-1 py-0.5 rounded">.env</code> file. Without it, you can use the <strong>Paste Menu Text</strong> tab to parse menus locally without an API key!
                </p>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />

          {!imagePreview ? (
            <div
              onClick={() => !isProcessingImage && fileInputRef.current?.click()}
              className={`border-2 border-dashed border-stone-700 hover:border-amber-400/60 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-stone-950/40 hover:bg-stone-950/80 group ${
                isProcessingImage ? 'opacity-60 cursor-wait' : ''
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-stone-850 group-hover:bg-amber-500/20 text-stone-400 group-hover:text-amber-400 flex items-center justify-center mx-auto mb-3 transition-colors border border-stone-750">
                {isProcessingImage ? (
                  <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>
              <h4 className="text-sm font-bold text-white mb-1">
                {isProcessingImage ? 'Optimizing Photo...' : 'Take Photo or Upload Menu Screenshot'}
              </h4>
              <p className="text-xs text-stone-400 max-w-sm mx-auto">
                {isProcessingImage
                  ? 'Resizing image for fast and sharp AI scanning...'
                  : 'Supports camera capture on mobile or JPG, PNG, WebP screenshots from bar apps.'}
              </p>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden border border-stone-700 bg-stone-950 max-h-80 flex items-center justify-center">
              <img
                src={imagePreview}
                alt="Menu preview"
                className="max-h-80 w-auto object-contain"
              />
              <button
                type="button"
                onClick={() => {
                  setImagePreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-stone-900/90 text-stone-200 text-xs font-semibold border border-stone-700 hover:bg-stone-800"
              >
                Change Photo
              </button>
            </div>
          )}

          {imagePreview && (
            <button
              type="button"
              onClick={() => handleScan()}
              disabled={isScanning || isProcessingImage}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
            >
              {isScanning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analyzing Drink Menu with Gemini AI...</span>
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
          <label htmlFor="menu-text-area" className="block text-xs font-semibold text-stone-300">
            Paste Menu Text / Tap List:
          </label>
          <textarea
            id="menu-text-area"
            rows={5}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={`Example:\nHeineken Vaasje 25cl 5% €3.60\nTripel Karmeliet 33cl 8.4% €5.90\nGuinness Pint 50cl €6.80`}
            className="w-full bg-stone-950 text-white rounded-xl p-3 text-xs sm:text-sm font-mono border border-stone-700 focus:outline-none focus:border-amber-400 placeholder:text-stone-600"
          />

          <button
            type="button"
            onClick={() => handleScan()}
            disabled={isScanning || !textInput.trim()}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
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
        <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-start sm:items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5 sm:mt-0" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
          {imagePreview && (
            <button
              type="button"
              onClick={() => handleScan()}
              disabled={isScanning}
              className="px-3 py-1.5 rounded-lg bg-rose-900/80 hover:bg-rose-800 text-white font-bold text-xs flex items-center gap-1.5 self-start sm:self-auto shrink-0 border border-rose-700/60 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>Retry Scan</span>
            </button>
          )}
        </div>
      )}

      {successNote && (
        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{successNote}</span>
        </div>
      )}

      {/* Extracted Drinks Review Table */}
      {scannedDrinks.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-stone-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Detected Drinks for {targetBar}</span>
                <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 font-mono whitespace-nowrap shrink-0">
                  {scannedDrinks.length} found
                </span>
              </h3>
              <p className="text-[11px] text-stone-400">
                Adjust any details before importing. Existing duplicates in {targetBar} are
                automatically flagged.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs text-stone-400 hover:text-stone-200 underline"
              >
                {selectedIds.size === scannedDrinks.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-stone-800 bg-stone-950/60 pb-1">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="bg-stone-900 text-stone-400 uppercase font-semibold text-[10px] tracking-wider border-b border-stone-800">
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
              <tbody className="divide-y divide-stone-800/60">
                {scannedDrinks.map((drink) => {
                  const isChecked = selectedIds.has(drink.id);
                  const dup = duplicateStatuses.get(drink.id);
                  const metrics = calculateDrinkMetrics(drink);

                  return (
                    <tr
                      key={drink.id}
                      className={`hover:bg-stone-900/40 transition-colors ${
                        isChecked ? 'bg-amber-500/5' : 'opacity-60'
                      }`}
                    >
                      <td className="p-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(drink.id)}
                          className="rounded border-stone-700 text-amber-500 focus:ring-amber-400 h-4 w-4 bg-stone-900"
                        />
                      </td>

                      <td className="p-2.5">
                        <input
                          type="text"
                          value={drink.name}
                          onChange={(e) =>
                            handleUpdateScannedItem(drink.id, 'name', e.target.value)
                          }
                          className="w-full bg-stone-900 text-white rounded px-2 py-1 text-xs border border-stone-800 focus:border-amber-400 font-medium"
                        />
                      </td>

                      <td className="p-2.5">
                        {!dup ? (
                          <span className="inline-block whitespace-nowrap text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                            New in bar
                          </span>
                        ) : dup.matchType === 'exact' ? (
                          <span
                            title="Exact same drink, volume, ABV, and price already in this bar"
                            className="inline-block whitespace-nowrap text-[10px] font-bold bg-stone-800 text-stone-400 border border-stone-700 px-2 py-0.5 rounded-full"
                          >
                            Exact duplicate
                          </span>
                        ) : dup.matchType === 'same_variant' ? (
                          <span
                            title={`Currently ${formatCurrency(dup.existingDrink.price, currency)} at this bar — importing will update it`}
                            className="inline-block whitespace-nowrap text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full"
                          >
                            Updates price
                          </span>
                        ) : (
                          <span
                            title={`Exists at ${dup.existingDrink.volumeMl}ml in this bar`}
                            className="inline-block whitespace-nowrap text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full"
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
                          className="w-full bg-stone-900 text-white font-mono rounded px-2 py-1 text-xs border border-stone-800 focus:border-amber-400"
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
                          className="w-full bg-stone-900 text-white font-mono rounded px-2 py-1 text-xs border border-stone-800 focus:border-amber-400"
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
                          className="w-full bg-stone-900 text-white font-mono rounded px-2 py-1 text-xs border border-stone-800 focus:border-amber-400"
                        />
                      </td>

                      <td className="p-2.5 text-right font-mono font-bold text-amber-400">
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
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-stone-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-40"
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
