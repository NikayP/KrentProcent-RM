import {
  CalculatedDrink,
  DEFAULT_BAR_NAME,
  DrinkCategory,
  formatCurrency,
} from './calculator';
import { DRINK_CATEGORY_META } from '../components/CategoryIcon';

export type ShareSortOption = 'krent' | 'price' | 'abv' | 'alcohol';

export interface TopThreeCardOptions {
  drinks: CalculatedDrink[];
  activeBar: string;
  selectedCategory: string;
  sortBy: ShareSortOption;
  searchQuery: string;
  currency: string;
}

const FONT_STACK =
  '"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const SORT_LABELS: Record<ShareSortOption, string> = {
  krent: 'BEST VALUE',
  price: 'LOWEST PRICE',
  abv: 'HIGHEST ABV',
  alcohol: 'MOST ALCOHOL',
};

let cachedLogoPromise: Promise<HTMLImageElement | null> | null = null;

function loadLogoImage(): Promise<HTMLImageElement | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!cachedLogoPromise) {
    cachedLogoPromise = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = '/favicon.svg';
    });
  }
  return cachedLogoPromise;
}

/** Preloads the brand icon into memory so click-to-share runs within the user activation window. */
export function preloadShareCardAssets(): void {
  void loadLogoImage();
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ellipsis = '…';
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(text.slice(0, mid) + ellipsis).width <= maxWidth) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return text.slice(0, Math.max(0, lo)).trimEnd() + ellipsis;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let current = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }

    if (!current) {
      // Single long word wider than maxWidth
      if (lines.length === maxLines - 1) {
        lines.push(truncateText(ctx, words.slice(i).join(' '), maxWidth));
        return lines;
      }
      lines.push(truncateText(ctx, word, maxWidth));
      continue;
    }

    if (lines.length === maxLines - 1) {
      const remaining = [current, ...words.slice(i)].join(' ');
      lines.push(truncateText(ctx, remaining, maxWidth));
      return lines;
    }

    lines.push(current);
    current = word;
  }

  if (current) {
    lines.push(current);
  }
  return lines.slice(0, maxLines);
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawFallbackLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const grad = ctx.createLinearGradient(x, y, x + size, y + size);
  grad.addColorStop(0, '#FF2A3B');
  grad.addColorStop(1, '#D91424');
  drawRoundedRect(ctx, x, y, size, size, size * 0.24);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 ${Math.round(size * 0.5)}px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('%', x + size / 2, y + size / 2 + 1);
  ctx.textAlign = 'left';
}

interface PillSpec {
  label: string;
  bg: string;
  border?: string;
  color: string;
}

function buildContextPills(options: TopThreeCardOptions, count: number): PillSpec[] {
  const pills: PillSpec[] = [
    {
      label: count === 1 ? '#1 PICK' : `TOP ${count}`,
      bg: '#F21B2D',
      color: '#FFFFFF',
    },
    {
      label: SORT_LABELS[options.sortBy],
      bg: '#222226',
      border: '#323238',
      color: '#E4E4E7',
    },
  ];

  if (options.selectedCategory !== 'all') {
    const meta = DRINK_CATEGORY_META[options.selectedCategory as DrinkCategory];
    pills.push({
      label: (meta?.filterLabel || options.selectedCategory).toUpperCase(),
      bg: 'rgba(242, 27, 45, 0.14)',
      border: 'rgba(242, 27, 45, 0.35)',
      color: '#FF8A8E',
    });
  }

  const trimmedQuery = options.searchQuery.trim();
  if (trimmedQuery) {
    const clipped =
      trimmedQuery.length > 18 ? `${trimmedQuery.slice(0, 17).trimEnd()}…` : trimmedQuery;
    pills.push({
      label: `“${clipped}”`,
      bg: '#1E1E22',
      border: '#323238',
      color: '#D4D4D8',
    });
  }

  return pills;
}

function getMetricDisplay(
  drink: CalculatedDrink,
  sortBy: ShareSortOption,
  currency: string
): { primary: string; secondary: string } {
  const krentSub = `${drink.pureAlcoholPerCurrency.toFixed(2)} ml/${currency}`;
  switch (sortBy) {
    case 'price':
      return { primary: formatCurrency(drink.price, currency), secondary: krentSub };
    case 'abv':
      return { primary: `${drink.abv.toFixed(1)}%`, secondary: krentSub };
    case 'alcohol':
      return { primary: `${drink.pureAlcoholMl.toFixed(1)} ml`, secondary: krentSub };
    case 'krent':
    default:
      return {
        primary: drink.pureAlcoholPerCurrency.toFixed(2),
        secondary: `ml/${currency}`,
      };
  }
}

/** Renders the dynamic Top 1-3 filtered drinks list into a high-DPI PNG Blob. */
export async function renderTopThreeShareCard(options: TopThreeCardOptions): Promise<Blob> {
  const topDrinks = options.drinks.slice(0, 3);
  if (topDrinks.length === 0) {
    throw new Error('No drinks to render.');
  }

  if (typeof document !== 'undefined' && 'fonts' in document) {
    await document.fonts.ready;
  }
  const logoImg = await loadLogoImage();

  const width = 600;
  const dpr = 2;
  const padX = 32;
  const contentWidth = width - padX * 2;

  // Measure layout using a scratch context first so total height is exact
  const measureCanvas = document.createElement('canvas');
  const mCtx = measureCanvas.getContext('2d');
  if (!mCtx) {
    throw new Error('Canvas 2D context is not supported.');
  }

  const titleMaxWidth = 322;
  const rowTitleLineHeight = 21;
  const cardGap = 12;

  const rowLayouts = topDrinks.map((drink) => {
    mCtx.font = `700 16px ${FONT_STACK}`;
    const titleLines = wrapText(mCtx, drink.name, titleMaxWidth, 2);
    const height = Math.max(82, 16 + titleLines.length * rowTitleLineHeight + 6 + 16 + 16);
    return { drink, titleLines, height };
  });

  const headerBottomY = 74;
  const pillsY = 92;
  const pillsHeight = 24;
  const dividerY = pillsY + pillsHeight + 16;
  const listStartY = dividerY + 18;
  const listTotalHeight =
    rowLayouts.reduce((sum, r) => sum + r.height, 0) + Math.max(0, rowLayouts.length - 1) * cardGap;
  const footerY = listStartY + listTotalHeight + 22;
  const totalHeight = footerY + 34;

  const canvas = document.createElement('canvas');
  canvas.width = width * dpr;
  canvas.height = totalHeight * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is not supported.');
  }
  ctx.scale(dpr, dpr);

  // 1. Background + subtle crimson ambient glow
  const bgGrad = ctx.createLinearGradient(0, 0, 0, totalHeight);
  bgGrad.addColorStop(0, '#141417');
  bgGrad.addColorStop(1, '#0F0F12');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, totalHeight);

  const glow = ctx.createRadialGradient(width * 0.15, 20, 10, width * 0.15, 20, 340);
  glow.addColorStop(0, 'rgba(242, 27, 45, 0.16)');
  glow.addColorStop(1, 'rgba(242, 27, 45, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, totalHeight);

  // 2. Header: logo + wordmark + venue scope pill
  const logoSize = 38;
  if (logoImg) {
    ctx.drawImage(logoImg, padX, 30, logoSize, logoSize);
  } else {
    drawFallbackLogo(ctx, padX, 30, logoSize);
  }

  ctx.textBaseline = 'middle';
  ctx.font = `800 22px ${FONT_STACK}`;
  const brandX = padX + logoSize + 12;
  const brandY = 30 + logoSize / 2 + 1;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('Krent', brandX, brandY);
  const krentWidth = ctx.measureText('Krent').width;
  ctx.fillStyle = '#F21B2D';
  ctx.fillText('Procent', brandX + krentWidth, brandY);

  const scopeText =
    options.activeBar === 'all' ? 'ALL BARS' : options.activeBar.toUpperCase();
  ctx.font = `700 11.5px ${FONT_STACK}`;
  const clippedScope = truncateText(ctx, scopeText, 190);
  const scopePillW = Math.ceil(ctx.measureText(clippedScope).width) + 24;
  const scopePillH = 28;
  const scopePillX = width - padX - scopePillW;
  const scopePillY = 35;

  drawRoundedRect(ctx, scopePillX, scopePillY, scopePillW, scopePillH, 9);
  ctx.fillStyle = '#1E1E22';
  ctx.fill();
  ctx.strokeStyle = 'rgba(242, 27, 45, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#F4F4F5';
  ctx.textAlign = 'center';
  ctx.fillText(clippedScope, scopePillX + scopePillW / 2, scopePillY + scopePillH / 2 + 0.5);
  ctx.textAlign = 'left';

  // Ensure unused reference check is clear
  void headerBottomY;

  // 3. Filter context pills
  const pills = buildContextPills(options, topDrinks.length);
  let pillX = padX;
  ctx.font = `700 11px ${FONT_STACK}`;
  for (const pill of pills) {
    const textW = ctx.measureText(pill.label).width;
    const pillW = Math.ceil(textW) + 18;
    if (pillX + pillW > width - padX) break;

    drawRoundedRect(ctx, pillX, pillsY, pillW, pillsHeight, 7);
    ctx.fillStyle = pill.bg;
    ctx.fill();
    if (pill.border) {
      ctx.strokeStyle = pill.border;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.fillStyle = pill.color;
    ctx.fillText(pill.label, pillX + 9, pillsY + pillsHeight / 2 + 0.5);
    pillX += pillW + 8;
  }

  // Subtle divider line
  ctx.strokeStyle = '#27272A';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, dividerY);
  ctx.lineTo(width - padX, dividerY);
  ctx.stroke();

  // 4. Top 1..3 Drink Rows
  let curY = listStartY;
  for (let i = 0; i < rowLayouts.length; i++) {
    const { drink, titleLines, height } = rowLayouts[i];
    const isFirst = i === 0;

    // Card surface
    drawRoundedRect(ctx, padX, curY, contentWidth, height, 14);
    ctx.fillStyle = isFirst ? '#1D1517' : '#18181B';
    ctx.fill();
    ctx.strokeStyle = isFirst ? 'rgba(242, 27, 45, 0.55)' : '#27272A';
    ctx.lineWidth = isFirst ? 1.5 : 1;
    ctx.stroke();

    // Rank badge (#1, #2, #3)
    const badgeSize = 36;
    const badgeX = padX + 16;
    const badgeY = curY + Math.round((height - badgeSize) / 2);
    drawRoundedRect(ctx, badgeX, badgeY, badgeSize, badgeSize, 10);
    ctx.fillStyle = isFirst ? '#F21B2D' : '#242429';
    ctx.fill();

    ctx.fillStyle = isFirst ? '#FFFFFF' : i === 1 ? '#E4E4E7' : '#A1A1AA';
    ctx.font = `800 14px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.fillText(`#${i + 1}`, badgeX + badgeSize / 2, badgeY + badgeSize / 2 + 0.5);
    ctx.textAlign = 'left';

    // Right metric column
    const metric = getMetricDisplay(drink, options.sortBy, options.currency);
    const metricRightX = width - padX - 18;
    const metricCenterY = curY + height / 2;

    ctx.textAlign = 'right';
    ctx.font = `800 22px ${FONT_STACK}`;
    ctx.fillStyle = isFirst ? '#FF4D5C' : '#FFFFFF';
    ctx.fillText(metric.primary, metricRightX, metricCenterY - 8);

    ctx.font = `600 11.5px ${FONT_STACK}`;
    ctx.fillStyle = '#A1A1AA';
    ctx.fillText(metric.secondary, metricRightX, metricCenterY + 13);
    ctx.textAlign = 'left';

    // Center drink title & metadata
    const textX = badgeX + badgeSize + 14;
    const titleStartY = curY + 16 + rowTitleLineHeight / 2;
    ctx.font = `700 16px ${FONT_STACK}`;
    ctx.fillStyle = '#FFFFFF';
    for (let l = 0; l < titleLines.length; l++) {
      ctx.fillText(titleLines[l], textX, titleStartY + l * rowTitleLineHeight);
    }

    const metaParts: string[] = [];
    if (options.activeBar === 'all') {
      metaParts.push(drink.barName || DEFAULT_BAR_NAME);
    }
    metaParts.push(`${Math.round(drink.volumeMl)} ml`);
    metaParts.push(`${drink.abv.toFixed(1)}%`);
    metaParts.push(formatCurrency(drink.price, options.currency));

    const metaY = curY + 16 + titleLines.length * rowTitleLineHeight + 6 + 7;
    ctx.font = `500 12.5px ${FONT_STACK}`;
    ctx.fillStyle = '#A1A1AA';
    ctx.fillText(truncateText(ctx, metaParts.join('  ·  '), titleMaxWidth), textX, metaY);

    curY += height + cardGap;
  }

  // 5. Footer
  ctx.font = `500 11.5px ${FONT_STACK}`;
  ctx.fillStyle = '#71717A';
  ctx.fillText('KrentProcent · Value per Euro', padX, footerY);

  const dateLabel = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());
  ctx.textAlign = 'right';
  ctx.fillText(dateLabel, width - padX, footerY);
  ctx.textAlign = 'left';

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to export PNG image.'));
    }, 'image/png');
  });
}

function buildShareFilename(activeBar: string): string {
  const slug =
    activeBar === 'all'
      ? 'all-bars'
      : activeBar
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'bar';
  return `krentprocent-top3-${slug}.png`;
}

function triggerPngDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

async function copyPngToClipboard(blob: Blob): Promise<boolean> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.clipboard?.write ||
    typeof ClipboardItem === 'undefined'
  ) {
    return false;
  }
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': blob,
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generates and shares the Top 1-3 PNG card:
 * - On mobile (Android/iOS): opens the native Web Share Sheet with the PNG file.
 * - On desktop (Windows/macOS/Linux): copies the PNG directly to the clipboard for instant Ctrl+V paste,
 *   falling back to a PNG file download if clipboard image write is unavailable.
 */
export async function shareTopThreeImage(
  options: TopThreeCardOptions
): Promise<'shared' | 'copied' | 'downloaded' | 'cancelled'> {
  const blob = await renderTopThreeShareCard(options);
  const filename = buildShareFilename(options.activeBar);
  const file = new File([blob], filename, { type: 'image/png' });

  const scopeTitle = options.activeBar === 'all' ? 'All Bars' : options.activeBar;
  const title = `KrentProcent Top ${Math.min(3, options.drinks.length)} — ${scopeTitle}`;

  if (
    isMobileDevice() &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        title,
        files: [file],
      });
      return 'shared';
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return 'cancelled';
      }
    }
  }

  if (await copyPngToClipboard(blob)) {
    return 'copied';
  }

  triggerPngDownload(blob, filename);
  return 'downloaded';
}
