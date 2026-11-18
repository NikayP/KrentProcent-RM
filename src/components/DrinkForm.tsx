import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus,
  Check,
  Store,
  AlertTriangle,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  StickyNote,
  X,
} from 'lucide-react';
import { DRINK_CATEGORY_LIST, CategoryIcon } from './CategoryIcon';
import {
  DrinkCategory,
  DrinkItem,
  calculateDrinkMetrics,
  formatCurrency,
  DEFAULT_BAR_NAME,
  canonicalizeBarName,
  findDuplicateDrinkInBar,
  areBarNamesEquivalent,
} from '../utils/calculator';
import { POPULAR_BAR_PRESETS } from '../presets/barData';

interface DrinkFormProps {
  onAddDrink: (drink: DrinkItem, mode?: 'update_existing' | 'force_add') => void;
  existingDrinks?: DrinkItem[];
  currency: string;
  activeBar: string;
  availableBars: string[];
  onSelectBar: (bar: string) => void;
}

const VOLUME_CHIPS_BY_CATEGORY: Record<DrinkCategory, { label: string; val: number }[]> = {
  beer: [
    { label: '200ml', val: 200 },
    { label: '250ml', val: 250 },
    { label: '330ml', val: 330 },
    { label: '500ml', val: 500 },
  ],
  cider: [
    { label: '250ml', val: 250 },
    { label: '330ml', val: 330 },
    { label: '440ml', val: 440 },
    { label: '500ml', val: 500 },
  ],
  wine: [
    { label: '125ml', val: 125 },
    { label: '150ml', val: 150 },
    { label: '175ml', val: 175 },
    { label: '750ml', val: 750 },
  ],
  spirit: [
    { label: '35ml', val: 35 },
    { label: '50ml', val: 50 },
    { label: '70ml', val: 70 },
    { label: '100ml', val: 100 },
  ],
  cocktail: [
    { label: '150ml', val: 150 },
    { label: '200ml', val: 200 },
    { label: '250ml', val: 250 },
    { label: '330ml', val: 330 },
  ],
  other: [
    { label: '150ml', val: 150 },
    { label: '250ml', val: 250 },
    { label: '330ml', val: 330 },
    { label: '500ml', val: 500 },
  ],
};

const ABV_CHIPS_BY_CATEGORY: Record<DrinkCategory, number[]> = {
  beer: [0, 5.0, 6.5, 8.5],
  cider: [4.5, 5.0, 6.0, 7.5],
  wine: [11.5, 12.5, 13.5, 14.5],
  spirit: [20, 35, 40, 45],
  cocktail: [8, 12, 15, 20],
  other: [5, 8.5, 12.5, 40],
};

const QUICK_TEMPLATES = [
  { label: 'Vaasje', preset: POPULAR_BAR_PRESETS[0] },
  { label: 'Pint', preset: POPULAR_BAR_PRESETS[1] },
  { label: 'Fluitje', preset: POPULAR_BAR_PRESETS[2] },
  { label: 'Tripel', preset: POPULAR_BAR_PRESETS[3] },
  { label: 'IPA', preset: POPULAR_BAR_PRESETS[4] },
  { label: 'Pitcher', preset: POPULAR_BAR_PRESETS[6] },
];

export const DrinkForm: React.FC<DrinkFormProps> = ({
  onAddDrink,
  existingDrinks = [],
  currency,
  activeBar,
  availableBars,
  onSelectBar,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showBarPicker, setShowBarPicker] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const [barName, setBarName] = useState(
    activeBar === 'all' ? availableBars[0] || DEFAULT_BAR_NAME : activeBar
  );
  const [name, setName] = useState('');
  const [category, setCategory] = useState<DrinkCategory>('beer');
  const [volumeMl, setVolumeMl] = useState<number>(330);
  const [abvText, setAbvText] = useState<string>('5');
  const abv = useMemo(() => {
    const parsed = parseFloat(abvText);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }, [abvText]);
  const [price, setPrice] = useState<number>(4.5);
  const [notes, setNotes] = useState('');
  const [justAddedMessage, setJustAddedMessage] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const justAddedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (justAddedTimerRef.current) clearTimeout(justAddedTimerRef.current);
    };
  }, []);

  // Sync barName when activeBar changes or when bar is deleted
  useEffect(() => {
    if (activeBar && activeBar !== 'all') {
      setBarName(activeBar);
      setShowBarPicker(false);
    } else if (activeBar === 'all' && availableBars.length > 0) {
      const matchesKnown = availableBars.some((b) => areBarNamesEquivalent(b, barName));
      if (!matchesKnown && !barName.trim()) {
        setBarName(availableBars[0]);
      }
    }
  }, [activeBar, availableBars]);

  const resolvedBarName = useMemo(() => {
    const raw = barName.trim() || DEFAULT_BAR_NAME;
    return canonicalizeBarName(raw, availableBars);
  }, [barName, availableBars]);

  // Live duplicate check scoped strictly to the selected bar
  const duplicateCheck = useMemo(() => {
    if (!name.trim()) return null;
    return findDuplicateDrinkInBar(existingDrinks, {
      name: name.trim(),
      barName: resolvedBarName,
      volumeMl: volumeMl || 0,
      abv: abv || 0,
      price: price || 0,
    });
  }, [existingDrinks, name, resolvedBarName, volumeMl, abv, price]);

  // Live calculation preview
  const preview = calculateDrinkMetrics({
    id: 'preview',
    name: name || 'Your Drink',
    barName: resolvedBarName,
    category,
    volumeMl: volumeMl || 0,
    abv: abv || 0,
    price: price || 0,
  });

  const openForm = (focusName = true) => {
    setIsExpanded(true);
    if (focusName) {
      setTimeout(() => nameInputRef.current?.focus(), 40);
    }
  };

  const submitWithMode = (mode: 'update_existing' | 'force_add') => {
    if (!name.trim()) return;
    if (volumeMl <= 0 || price <= 0 || abv < 0) return;

    const newDrink: DrinkItem = {
      id: `drink-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      barName: resolvedBarName,
      category,
      volumeMl,
      abv,
      price,
      notes: notes.trim(),
    };

    const isUpdatingExisting =
      mode === 'update_existing' &&
      duplicateCheck &&
      (duplicateCheck.matchType === 'exact' || duplicateCheck.matchType === 'same_variant');

    onAddDrink(newDrink, mode);

    if (activeBar !== 'all' && !areBarNamesEquivalent(activeBar, resolvedBarName)) {
      onSelectBar(resolvedBarName);
    }

    setJustAddedMessage(
      isUpdatingExisting
        ? `Updated in ${resolvedBarName}`
        : `Added to ${resolvedBarName}`
    );
    if (justAddedTimerRef.current) clearTimeout(justAddedTimerRef.current);
    justAddedTimerRef.current = setTimeout(() => {
      justAddedTimerRef.current = null;
      setJustAddedMessage(null);
    }, 1600);

    setName('');
    setNotes('');
    setShowNotes(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitWithMode('update_existing');
  };

  const applyPreset = (preset: DrinkItem, expandIfClosed = false) => {
    setName(preset.name);
    setCategory(preset.category);
    setVolumeMl(preset.volumeMl);
    setAbvText(String(preset.abv));
    setPrice(preset.price);
    setNotes(preset.notes || '');
    if (!barName.trim() && preset.barName) {
      setBarName(preset.barName);
    }
    if (expandIfClosed && !isExpanded) {
      setIsExpanded(true);
    }
  };

  const volumeChips = VOLUME_CHIPS_BY_CATEGORY[category];
  const abvChips = ABV_CHIPS_BY_CATEGORY[category];
  const priceChips = [3.0, 4.0, 5.0, 6.5];

  // Compact collapsed bar: keeps Leaderboard at the top of the screen
  if (!isExpanded) {
    return (
      <div
        id="tour-drink-presets"
        className="bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl px-3 py-2.5 sm:px-4 shadow-sm flex items-center gap-2.5 overflow-hidden"
      >
        <button
          type="button"
          onClick={() => openForm(true)}
          className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F21B2D] hover:bg-[#D91424] text-white text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.75]" />
          <span>Add Drink</span>
        </button>

        <div className="h-5 w-px bg-[#E4E4E7] dark:bg-[#27272A] shrink-0" />

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0 flex-1 py-0.5">
          <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 shrink-0 hidden sm:inline mr-0.5">
            Quick:
          </span>
          {QUICK_TEMPLATES.map(({ label, preset }) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset, true)}
              className="shrink-0 px-2.5 py-1.5 text-xs font-medium rounded-xl bg-[#FAFAFA] dark:bg-[#121214] hover:bg-[#FFF2F3] dark:hover:bg-[#27272A] hover:text-[#D91424] dark:hover:text-[#FF8A8E] text-zinc-700 dark:text-zinc-300 border border-[#E4E4E7] dark:border-[#27272A] transition-colors whitespace-nowrap cursor-pointer"
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => openForm(true)}
          aria-label="Expand add drink form"
          className="shrink-0 hidden sm:inline-flex items-center justify-center w-8 h-8 rounded-xl text-zinc-400 hover:text-[#18181B] dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#27272A] transition-colors cursor-pointer"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      id="tour-drink-presets"
      className="bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl p-3.5 sm:p-4 shadow-sm"
    >
      {/* Compact Header: Title + Bar pill + Quick Templates + Collapse */}
      <div className="flex flex-col gap-2.5 mb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h2 className="text-sm sm:text-base font-extrabold tracking-[-0.02em] text-[#18181B] dark:text-[#FFFFFF]">
              Add Drink
            </h2>
            <button
              type="button"
              onClick={() => setShowBarPicker((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer max-w-full ${
                showBarPicker
                  ? 'bg-[#FFF2F3] dark:bg-[#F21B2D]/15 text-[#D91424] dark:text-[#FF8A8E] border-[#F21B2D]/40'
                  : 'bg-[#FAFAFA] dark:bg-[#121214] text-zinc-600 dark:text-zinc-300 border-[#E4E4E7] dark:border-[#27272A] hover:border-zinc-300 dark:hover:border-zinc-600'
              }`}
              title="Change target bar"
            >
              <Store className="w-3 h-3 text-[#F21B2D] shrink-0" />
              <span className="truncate max-w-[160px] sm:max-w-[220px]">{resolvedBarName}</span>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal">
                {showBarPicker ? 'Hide' : 'Change'}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-[#18181B] dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#27272A] transition-colors cursor-pointer"
          >
            <ChevronUp className="w-3.5 h-3.5" />
            <span>Hide</span>
          </button>
        </div>

        {/* Single-line scrollable template pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider shrink-0 mr-0.5">
            Quick:
          </span>
          {QUICK_TEMPLATES.map(({ label, preset }) => {
            const isMatchingPreset =
              name === preset.name && volumeMl === preset.volumeMl && abv === preset.abv;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`shrink-0 px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                  isMatchingPreset
                    ? 'bg-[#FFF2F3] dark:bg-[#F21B2D]/15 text-[#D91424] dark:text-[#FF8A8E] border-[#F21B2D]/40 font-semibold'
                    : 'bg-[#FAFAFA] dark:bg-[#121214] hover:bg-[#FFF2F3] dark:hover:bg-[#27272A] text-zinc-600 dark:text-zinc-300 border-[#E4E4E7] dark:border-[#27272A]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Optional Inline Bar Picker (only shown when user clicks "Change") */}
        {showBarPicker && (
          <div className="bg-[#FAFAFA] dark:bg-[#121214] p-2.5 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] space-y-2">
            {availableBars.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {availableBars.slice(0, 5).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => {
                      setBarName(b);
                      onSelectBar(b);
                    }}
                    className={`text-[11px] px-2.5 py-0.5 rounded-lg font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                      areBarNamesEquivalent(barName, b)
                        ? 'bg-[#F21B2D] text-white border-[#F21B2D] font-semibold'
                        : 'bg-[#FFFFFF] dark:bg-[#18181B] text-zinc-600 dark:text-zinc-300 border-[#E4E4E7] dark:border-[#27272A] hover:text-[#18181B] dark:hover:text-white'
                    }`}
                  >
                    {b}
                  </button>
                ))}
                {availableBars.length > 5 && (
                  <select
                    value={availableBars.some((b) => areBarNamesEquivalent(barName, b)) ? resolvedBarName : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        setBarName(e.target.value);
                        onSelectBar(e.target.value);
                      }
                    }}
                    aria-label="All known bars"
                    className="text-[11px] px-2 py-0.5 rounded-lg bg-[#FFFFFF] dark:bg-[#18181B] text-[#F21B2D] border border-[#E4E4E7] dark:border-[#27272A] font-semibold focus:outline-none focus:border-[#F21B2D]"
                  >
                    <option value="">+{availableBars.length - 5} more...</option>
                    {availableBars.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
            <input
              id="bar-name-input"
              list="known-bars-datalist"
              type="text"
              value={barName}
              onChange={(e) => setBarName(e.target.value)}
              placeholder="Bar / venue name..."
              required
              className="w-full bg-[#FFFFFF] dark:bg-[#18181B] text-[#18181B] dark:text-[#FFFFFF] font-medium text-xs sm:text-sm rounded-xl px-3 py-1.5 border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D] placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            />
            <datalist id="known-bars-datalist">
              {availableBars.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
        )}

        {/* Row 1: Drink Name + Compact Category Strip */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
          <div className="flex-1 min-w-0">
            <input
              ref={nameInputRef}
              id="drink-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Drink name (e.g. Heineken Vaasje, Tripel Karmeliet...)"
              aria-label="Drink name"
              required
              className="w-full bg-[#FAFAFA] dark:bg-[#121214] text-[#18181B] dark:text-[#FFFFFF] rounded-xl px-3.5 py-2 text-sm font-medium border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D] focus:bg-[#FFFFFF] dark:focus:bg-[#18181B] transition-colors placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            />
          </div>

          <div
            className="flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0 py-0.5"
            role="radiogroup"
            aria-label="Drink category"
          >
            {DRINK_CATEGORY_LIST.map((cat) => {
              const isSelected = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setCategory(cat.id)}
                  className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#F21B2D] border-[#F21B2D] text-white'
                      : 'bg-[#FAFAFA] dark:bg-[#121214] border-[#E4E4E7] dark:border-[#27272A] text-zinc-600 dark:text-zinc-400 hover:text-[#18181B] dark:hover:text-white'
                  }`}
                >
                  <CategoryIcon
                    category={cat.id}
                    className="w-3.5 h-3.5"
                    colored={!isSelected}
                  />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional Note input (shown on click) */}
        {showNotes && (
          <div className="flex items-center gap-2">
            <input
              id="drink-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional note (e.g. Draft, Bottle, Happy Hour...)"
              aria-label="Optional notes"
              className="flex-1 bg-[#FAFAFA] dark:bg-[#121214] text-[#18181B] dark:text-[#FFFFFF] rounded-xl px-3 py-1.5 text-xs border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D] placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            />
            <button
              type="button"
              onClick={() => {
                setNotes('');
                setShowNotes(false);
              }}
              aria-label="Remove note"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-[#27272A] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Live Per-Bar Duplicate Detection Alert */}
        {duplicateCheck && (
          <div
            className={`px-3 py-2 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
              duplicateCheck.matchType === 'exact' || duplicateCheck.matchType === 'same_variant'
                ? 'bg-[#FFF2F3] dark:bg-[#F21B2D]/10 border-[#FF8A8E]/50 dark:border-[#F21B2D]/40 text-[#18181B] dark:text-zinc-100'
                : 'bg-[#FAFAFA] dark:bg-[#121214] border-[#E4E4E7] dark:border-[#27272A] text-[#18181B] dark:text-zinc-300'
            }`}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-[#F21B2D] shrink-0 mt-0.5" />
              <div>
                {duplicateCheck.matchType === 'exact' && (
                  <span>
                    <strong>Already on {resolvedBarName}:</strong> &ldquo;
                    {duplicateCheck.existingDrink.name}&rdquo; ({duplicateCheck.existingDrink.volumeMl}
                    ml, {duplicateCheck.existingDrink.abv}%,{' '}
                    {formatCurrency(duplicateCheck.existingDrink.price, currency)}).
                  </span>
                )}
                {duplicateCheck.matchType === 'same_variant' && (
                  <span>
                    <strong>On {resolvedBarName} at {formatCurrency(duplicateCheck.existingDrink.price, currency)}:</strong>{' '}
                    submitting updates this {duplicateCheck.existingDrink.volumeMl}ml entry.
                  </span>
                )}
                {duplicateCheck.matchType === 'same_name_diff_volume' && (
                  <span>
                    Exists at {resolvedBarName} in {duplicateCheck.existingDrink.volumeMl}ml (
                    {formatCurrency(duplicateCheck.existingDrink.price, currency)}). Will add as{' '}
                    {volumeMl}ml option.
                  </span>
                )}
              </div>
            </div>

            {(duplicateCheck.matchType === 'exact' ||
              duplicateCheck.matchType === 'same_variant') && (
              <button
                type="button"
                onClick={() => submitWithMode('force_add')}
                className="shrink-0 self-start sm:self-auto px-2.5 py-1 rounded-lg bg-[#FFFFFF] dark:bg-[#18181B] hover:bg-zinc-50 dark:hover:bg-[#27272A] text-[#18181B] dark:text-zinc-200 border border-[#E4E4E7] dark:border-[#27272A] text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                Add Separately
              </button>
            )}
          </div>
        )}

        {/* Row 2: 3 Clean Numeric Inputs (Volume, ABV, Price) without nested cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Volume */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="drink-volume" className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                Volume (ml)
              </label>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums font-medium">
                {volumeMl ? `${(volumeMl / 10).toFixed(0)} cl` : '0 cl'}
              </span>
            </div>
            <div className="flex items-center bg-[#FAFAFA] dark:bg-[#121214] border border-[#E4E4E7] dark:border-[#27272A] focus-within:border-[#F21B2D] focus-within:bg-[#FFFFFF] dark:focus-within:bg-[#18181B] rounded-xl px-3 py-1.5 transition-colors">
              <input
                id="drink-volume"
                type="number"
                min="10"
                max="5000"
                step="1"
                value={volumeMl || ''}
                onChange={(e) => setVolumeMl(parseFloat(e.target.value) || 0)}
                required
                className="w-full bg-transparent text-[#18181B] dark:text-[#FFFFFF] tabular-nums font-bold text-sm focus:outline-none"
              />
              <span className="text-xs font-medium text-zinc-400 ml-1.5">ml</span>
            </div>
            <div className="grid grid-cols-4 gap-1 mt-1.5">
              {volumeChips.map((chip) => (
                <button
                  key={chip.val}
                  type="button"
                  onClick={() => setVolumeMl(chip.val)}
                  className={`text-[10px] py-0.5 rounded-lg font-medium border transition-colors truncate cursor-pointer ${
                    volumeMl === chip.val
                      ? 'bg-[#F21B2D] text-white border-[#F21B2D] font-bold'
                      : 'bg-transparent text-zinc-500 dark:text-zinc-400 border-[#E4E4E7] dark:border-[#27272A] hover:text-[#18181B] dark:hover:text-white'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* ABV % */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="drink-abv" className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                Alcohol (ABV %)
              </label>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums font-medium">
                {abv ? `${abv.toFixed(1)}%` : '0%'}
              </span>
            </div>
            <div className="flex items-center bg-[#FAFAFA] dark:bg-[#121214] border border-[#E4E4E7] dark:border-[#27272A] focus-within:border-[#F21B2D] focus-within:bg-[#FFFFFF] dark:focus-within:bg-[#18181B] rounded-xl px-3 py-1.5 transition-colors">
              <input
                id="drink-abv"
                type="number"
                min="0"
                max="100"
                step="0.1"
                placeholder="0"
                value={abvText}
                onChange={(e) => setAbvText(e.target.value)}
                required
                className="w-full bg-transparent text-[#18181B] dark:text-[#FFFFFF] tabular-nums font-bold text-sm focus:outline-none"
              />
              <span className="text-xs font-medium text-zinc-400 ml-1.5">%</span>
            </div>
            <div className="grid grid-cols-4 gap-1 mt-1.5">
              {abvChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setAbvText(String(chip))}
                  className={`text-[10px] py-0.5 rounded-lg font-medium border transition-colors cursor-pointer ${
                    abvText.trim() !== '' && abv === chip
                      ? 'bg-[#F21B2D] text-white border-[#F21B2D] font-bold'
                      : 'bg-transparent text-zinc-500 dark:text-zinc-400 border-[#E4E4E7] dark:border-[#27272A] hover:text-[#18181B] dark:hover:text-white'
                  }`}
                >
                  {chip}%
                </button>
              ))}
            </div>
          </div>

          {/* Price */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="drink-price" className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                Price ({currency})
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPrice((p) => Math.max(0.5, Number((p - 0.5).toFixed(2))))}
                  className="px-1.5 text-[10px] leading-4 rounded border border-[#E4E4E7] dark:border-[#27272A] text-zinc-500 dark:text-zinc-400 hover:text-[#18181B] dark:hover:text-white cursor-pointer"
                  title="Minus 0.50"
                >
                  -0.50
                </button>
                <button
                  type="button"
                  onClick={() => setPrice((p) => Number((p + 0.5).toFixed(2)))}
                  className="px-1.5 text-[10px] leading-4 rounded border border-[#E4E4E7] dark:border-[#27272A] text-zinc-500 dark:text-zinc-400 hover:text-[#18181B] dark:hover:text-white cursor-pointer"
                  title="Plus 0.50"
                >
                  +0.50
                </button>
              </div>
            </div>
            <div className="flex items-center bg-[#FAFAFA] dark:bg-[#121214] border border-[#E4E4E7] dark:border-[#27272A] focus-within:border-[#F21B2D] focus-within:bg-[#FFFFFF] dark:focus-within:bg-[#18181B] rounded-xl px-3 py-1.5 transition-colors">
              <span className="text-xs font-semibold text-zinc-400 mr-1.5">{currency}</span>
              <input
                id="drink-price"
                type="number"
                min="0.01"
                max="5000"
                step="0.01"
                value={price || ''}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                required
                className="w-full bg-transparent text-[#18181B] dark:text-[#FFFFFF] tabular-nums font-bold text-sm focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-4 gap-1 mt-1.5">
              {priceChips.map((pVal) => (
                <button
                  key={pVal}
                  type="button"
                  onClick={() => setPrice(pVal)}
                  className={`text-[10px] py-0.5 rounded-lg font-medium border transition-colors truncate cursor-pointer ${
                    price === pVal
                      ? 'bg-[#F21B2D] text-white border-[#F21B2D] font-bold'
                      : 'bg-transparent text-zinc-500 dark:text-zinc-400 border-[#E4E4E7] dark:border-[#27272A] hover:text-[#18181B] dark:hover:text-white'
                  }`}
                >
                  {formatCurrency(pVal, currency)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer: Compact Live Score + Optional Note Toggle + Submit */}
        <div className="pt-2.5 border-t border-[#E4E4E7] dark:border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <div className="flex items-baseline gap-1">
              <span className="text-zinc-500 dark:text-zinc-400">Score:</span>
              <span className="text-[#F21B2D] font-extrabold text-sm tabular-nums">
                {preview.pureAlcoholPerCurrency} ml/{currency}
              </span>
            </div>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            <span className="text-zinc-500 dark:text-zinc-400 tabular-nums">
              {preview.pureAlcoholMl} ml pure alc
            </span>

            {!showNotes && (
              <>
                <span className="text-zinc-300 dark:text-zinc-700">·</span>
                <button
                  type="button"
                  onClick={() => setShowNotes(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-[#18181B] dark:hover:text-white transition-colors cursor-pointer"
                >
                  <StickyNote className="w-3 h-3" />
                  <span>{notes ? `Note: ${notes}` : '+ Note'}</span>
                </button>
              </>
            )}
          </div>

          <button
            type="submit"
            className={`w-full sm:w-auto px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer ${
              justAddedMessage
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                : 'bg-[#F21B2D] hover:bg-[#D91424] text-white'
            }`}
          >
            {justAddedMessage ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{justAddedMessage}</span>
              </>
            ) : duplicateCheck &&
              (duplicateCheck.matchType === 'exact' ||
                duplicateCheck.matchType === 'same_variant') ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Update at {resolvedBarName}</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 stroke-[2.75]" />
                <span>Add Drink</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
