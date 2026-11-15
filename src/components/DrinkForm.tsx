import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Check,
  Store,
  AlertTriangle,
  RefreshCw,
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
  normalizeDrinkKey,
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

export const DrinkForm: React.FC<DrinkFormProps> = ({
  onAddDrink,
  existingDrinks = [],
  currency,
  activeBar,
  availableBars,
  onSelectBar,
}) => {
  const [barName, setBarName] = useState(
    activeBar === 'all' ? availableBars[0] || DEFAULT_BAR_NAME : activeBar
  );
  const [name, setName] = useState('');
  const [category, setCategory] = useState<DrinkCategory>('beer');
  const [volumeMl, setVolumeMl] = useState<number>(330);
  const [abv, setAbv] = useState<number>(5.0);
  const [price, setPrice] = useState<number>(4.5);
  const [notes, setNotes] = useState('');
  const [justAddedMessage, setJustAddedMessage] = useState<string | null>(null);

  // Sync barName when activeBar changes or when bar is deleted
  useEffect(() => {
    if (activeBar && activeBar !== 'all') {
      setBarName(activeBar);
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
        ? `Updated in ${resolvedBarName}!`
        : `Added to ${resolvedBarName}!`
    );
    setTimeout(() => setJustAddedMessage(null), 1500);

    setName('');
    setNotes('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitWithMode('update_existing');
  };

  const applyPreset = (preset: DrinkItem, keepCurrentBar = true) => {
    setName(preset.name);
    setCategory(preset.category);
    setVolumeMl(preset.volumeMl);
    setAbv(preset.abv);
    setPrice(preset.price);
    setNotes(preset.notes || '');
    if (!keepCurrentBar && preset.barName) {
      setBarName(preset.barName);
    } else if (!barName.trim() && preset.barName) {
      setBarName(preset.barName);
    }
  };

  const volumeChips = [
    { label: '200ml (Fluitje)', val: 200 },
    { label: '250ml (Vaasje)', val: 250 },
    { label: '330ml (Flesje)', val: 330 },
    { label: '500ml (Pint)', val: 500 },
    { label: '568ml (UK Pint)', val: 568 },
    { label: '1.5L (Pitcher)', val: 1500 },
    { label: '150ml (Wine)', val: 150 },
    { label: '35ml (Shot)', val: 35 },
  ];

  const abvChips = [4.5, 5.0, 5.5, 6.5, 8.0, 8.5, 10.0, 12.5, 40.0];

  return (
    <div className="bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl p-4 sm:p-6 shadow-sm relative overflow-hidden">
      {/* Background ambient glow matching inspiration card aesthetic */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-[#FF8A8E]/15 dark:bg-[#F21B2D]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header & Quick Bar Presets */}
      <div id="tour-drink-presets" className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 mb-4">
        <div>
          <h2 className="text-lg font-extrabold tracking-[-0.03em] text-[#18181B] dark:text-[#FFFFFF] flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F21B2D] animate-pulse" />
            Add Drink to Compare
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Compare pure alcohol vs price for your current bar. Duplicates per bar are automatically detected.
          </p>
        </div>

        {/* 1-tap presets bar */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap mr-1">
            Templates:
          </span>
          {[
            { label: 'Vaasje (25cl)', preset: POPULAR_BAR_PRESETS[0] },
            { label: 'Pint (50cl)', preset: POPULAR_BAR_PRESETS[1] },
            { label: 'Fluitje (20cl)', preset: POPULAR_BAR_PRESETS[2] },
            { label: 'Tripel (8.5%)', preset: POPULAR_BAR_PRESETS[3] },
            { label: 'IPA (6.5%)', preset: POPULAR_BAR_PRESETS[4] },
            { label: 'Pitcher (1.5L)', preset: POPULAR_BAR_PRESETS[6] },
          ].map(({ label, preset }) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset, true)}
              className="px-2.5 py-1 text-xs font-medium rounded-xl bg-[#FFF2F3] dark:bg-[#121214] hover:bg-[#FF8A8E]/25 dark:hover:bg-[#FF8A8E]/20 hover:text-[#D91424] dark:hover:text-[#FF8A8E] text-[#18181B] dark:text-zinc-300 border border-[#E4E4E7] dark:border-[#27272A] transition-colors whitespace-nowrap"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* BAR NAME & VENUE ROW */}
        <div className="bg-[#FFF2F3]/60 dark:bg-[#121214] p-3 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label
              htmlFor="bar-name-input"
              className="text-xs font-bold text-[#F21B2D] uppercase tracking-wider flex items-center gap-1.5 shrink-0"
            >
              <Store className="w-3.5 h-3.5 text-[#F21B2D]" />
              <span>Which Bar are you sitting at? *</span>
            </label>

            {availableBars.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase mr-1">Known Bars:</span>
                {availableBars.slice(0, 4).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => {
                      setBarName(b);
                      onSelectBar(b);
                    }}
                    className={`text-[10px] px-2.5 py-0.5 rounded-lg font-medium border transition-colors whitespace-nowrap ${
                      areBarNamesEquivalent(barName, b)
                        ? 'bg-[#F21B2D] hover:bg-[#D91424] text-white border-[#F21B2D] font-bold'
                        : 'bg-[#FFFFFF] dark:bg-[#18181B] text-zinc-600 dark:text-zinc-400 border-[#E4E4E7] dark:border-[#27272A] hover:text-[#18181B] dark:hover:text-white'
                    }`}
                  >
                    {b}
                  </button>
                ))}
                {availableBars.length > 4 && (
                  <select
                    value={availableBars.some((b) => areBarNamesEquivalent(barName, b)) ? resolvedBarName : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        setBarName(e.target.value);
                        onSelectBar(e.target.value);
                      }
                    }}
                    aria-label="All known bars"
                    className="text-[10px] px-2 py-0.5 rounded-lg bg-[#FFFFFF] dark:bg-[#18181B] text-[#F21B2D] border border-[#E4E4E7] dark:border-[#27272A] font-semibold focus:outline-none focus:border-[#F21B2D]"
                  >
                    <option value="">+{availableBars.length - 4} more bars...</option>
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

          <div className="flex items-center gap-2">
            <input
              id="bar-name-input"
              list="known-bars-datalist"
              type="text"
              value={barName}
              onChange={(e) => setBarName(e.target.value)}
              placeholder="e.g. Café De Dokter, Gollem, The Waterhole..."
              required
              className="w-full bg-[#FFFFFF] dark:bg-[#18181B] text-[#18181B] dark:text-[#FFFFFF] font-medium text-xs sm:text-sm rounded-xl px-3 py-2 border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D] placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            />
            <datalist id="known-bars-datalist">
              {availableBars.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Drink Name, Notes & Category */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5">
            <label
              htmlFor="drink-name"
              className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider mb-1.5"
            >
              Drink Name / Label *
            </label>
            <input
              id="drink-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Heineken Vaasje, Tripel Karmeliet..."
              required
              className="w-full bg-[#FFFFFF] dark:bg-[#121214] text-[#18181B] dark:text-[#FFFFFF] rounded-xl px-3.5 py-2.5 text-sm border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D] focus:ring-1 focus:ring-[#F21B2D] transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="drink-notes"
              className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider mb-1.5"
            >
              Notes (Opt.)
            </label>
            <input
              id="drink-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Draft, Bottle"
              className="w-full bg-[#FFFFFF] dark:bg-[#121214] text-[#18181B] dark:text-[#FFFFFF] rounded-xl px-3 py-2.5 text-sm border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D] transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            />
          </div>

          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
              Category
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-3 gap-1.5">
              {DRINK_CATEGORY_LIST.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-[11px] font-semibold transition-all border ${
                      isSelected
                        ? 'bg-[#F21B2D] hover:bg-[#D91424] border-[#F21B2D] text-white shadow-sm'
                        : 'bg-[#FFF2F3]/50 dark:bg-[#121214] border-[#E4E4E7] dark:border-[#27272A] text-zinc-600 dark:text-zinc-400 hover:text-[#18181B] dark:hover:text-white hover:bg-[#FF8A8E]/15 dark:hover:bg-[#27272A]'
                    }`}
                  >
                    <CategoryIcon
                      category={cat.id}
                      className="w-3.5 h-3.5"
                      colored={!isSelected}
                    />
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Live Per-Bar Duplicate Detection Alert */}
        {duplicateCheck && (
          <div
            className={`p-3 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
              duplicateCheck.matchType === 'exact' || duplicateCheck.matchType === 'same_variant'
                ? 'bg-[#FF8A8E]/15 dark:bg-[#F21B2D]/10 border-[#FF8A8E]/50 dark:border-[#F21B2D]/40 text-[#18181B] dark:text-zinc-100'
                : 'bg-[#FFF2F3]/60 dark:bg-[#121214] border-[#E4E4E7] dark:border-[#27272A] text-[#18181B] dark:text-zinc-300'
            }`}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-[#F21B2D] shrink-0 mt-0.5" />
              <div>
                {duplicateCheck.matchType === 'exact' && (
                  <span>
                    <strong>Exact duplicate at {resolvedBarName}:</strong> &ldquo;
                    {duplicateCheck.existingDrink.name}&rdquo; ({duplicateCheck.existingDrink.volumeMl}
                    ml, {duplicateCheck.existingDrink.abv}%,{' '}
                    {formatCurrency(duplicateCheck.existingDrink.price, currency)}) is already on
                    this bar&apos;s menu.
                  </span>
                )}
                {duplicateCheck.matchType === 'same_variant' && (
                  <span>
                    <strong>Already on menu at {resolvedBarName}:</strong> &ldquo;
                    {duplicateCheck.existingDrink.name}&rdquo; ({duplicateCheck.existingDrink.volumeMl}
                    ml) is currently recorded at{' '}
                    <strong>{formatCurrency(duplicateCheck.existingDrink.price, currency)}</strong> (
                    {duplicateCheck.existingDrink.abv}% ABV). Submitting will update the existing
                    entry for this bar.
                  </span>
                )}
                {duplicateCheck.matchType === 'same_name_diff_volume' && (
                  <span>
                    <strong>Same drink name at {resolvedBarName} with different size:</strong>{' '}
                    &ldquo;{duplicateCheck.existingDrink.name}&rdquo; exists at{' '}
                    {duplicateCheck.existingDrink.volumeMl}ml (
                    {formatCurrency(duplicateCheck.existingDrink.price, currency)}). This will be
                    added as a {volumeMl}ml size option.
                  </span>
                )}
              </div>
            </div>

            {(duplicateCheck.matchType === 'exact' ||
              duplicateCheck.matchType === 'same_variant') && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => submitWithMode('force_add')}
                  className="px-2.5 py-1.5 rounded-xl bg-[#FFFFFF] dark:bg-[#18181B] hover:bg-zinc-50 dark:hover:bg-[#27272A] text-[#18181B] dark:text-zinc-200 border border-[#E4E4E7] dark:border-[#27272A] text-[11px] font-semibold transition-colors whitespace-nowrap"
                >
                  Add as Separate Item Anyway
                </button>
              </div>
            )}
          </div>
        )}

        {/* 3 Core Numeric Inputs: Volume, ABV, Price */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Volume */}
          <div className="bg-[#FFF2F3]/60 dark:bg-[#121214] p-3 rounded-xl border border-[#E4E4E7] dark:border-[#27272A]">
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="drink-volume" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Volume (ml) *
              </label>
              <span className="text-[11px] text-[#F21B2D] tabular-nums font-bold">
                {volumeMl ? `${(volumeMl / 10).toFixed(0)} cl` : '0 cl'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="drink-volume"
                type="number"
                min="10"
                max="5000"
                step="1"
                value={volumeMl || ''}
                onChange={(e) => setVolumeMl(parseFloat(e.target.value) || 0)}
                required
                className="w-full bg-[#FFFFFF] dark:bg-[#18181B] text-[#18181B] dark:text-[#FFFFFF] tabular-nums font-extrabold tracking-[-0.02em] text-base rounded-xl px-3 py-2 border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D]"
              />
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">ml</span>
            </div>

            {/* Quick volume chips */}
            <div className="flex flex-wrap gap-1 mt-2">
              {volumeChips.map((chip) => (
                <button
                  key={chip.val}
                  type="button"
                  onClick={() => setVolumeMl(chip.val)}
                  className={`text-[10px] px-2 py-0.5 rounded-lg font-medium transition-colors ${
                    volumeMl === chip.val
                      ? 'bg-[#F21B2D] hover:bg-[#D91424] text-white font-bold'
                      : 'bg-[#FFFFFF] dark:bg-[#18181B] hover:bg-[#FF8A8E]/15 text-zinc-600 dark:text-zinc-300 border border-[#E4E4E7] dark:border-[#27272A]'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* ABV % */}
          <div className="bg-[#FFF2F3]/60 dark:bg-[#121214] p-3 rounded-xl border border-[#E4E4E7] dark:border-[#27272A]">
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="drink-abv" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                ABV (%) *
              </label>
              <span className="text-[11px] text-[#F21B2D] tabular-nums font-bold">
                {abv ? `${abv.toFixed(1)}%` : '0%'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="drink-abv"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={abv || ''}
                onChange={(e) => setAbv(parseFloat(e.target.value) || 0)}
                required
                className="w-full bg-[#FFFFFF] dark:bg-[#18181B] text-[#18181B] dark:text-[#FFFFFF] tabular-nums font-extrabold tracking-[-0.02em] text-base rounded-xl px-3 py-2 border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D]"
              />
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">%</span>
            </div>

            {/* Quick ABV chips */}
            <div className="flex flex-wrap gap-1 mt-2">
              {abvChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setAbv(chip)}
                  className={`text-[10px] px-2 py-0.5 rounded-lg font-medium transition-colors ${
                    abv === chip
                      ? 'bg-[#F21B2D] hover:bg-[#D91424] text-white font-bold'
                      : 'bg-[#FFFFFF] dark:bg-[#18181B] hover:bg-[#FF8A8E]/15 text-zinc-600 dark:text-zinc-300 border border-[#E4E4E7] dark:border-[#27272A]'
                  }`}
                >
                  {chip}%
                </button>
              ))}
            </div>
          </div>

          {/* Price */}
          <div className="bg-[#FFF2F3]/60 dark:bg-[#121214] p-3 rounded-xl border border-[#E4E4E7] dark:border-[#27272A]">
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="drink-price" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Price ({currency}) *
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPrice((p) => Math.max(0.5, Number((p - 0.5).toFixed(2))))}
                  className="px-1.5 py-0.5 text-[10px] rounded-lg bg-[#FFFFFF] dark:bg-[#18181B] hover:bg-[#FF8A8E]/20 text-zinc-700 dark:text-zinc-300 border border-[#E4E4E7] dark:border-[#27272A]"
                  title="Minus 0.50"
                >
                  -0.50
                </button>
                <button
                  type="button"
                  onClick={() => setPrice((p) => Number((p + 0.5).toFixed(2)))}
                  className="px-1.5 py-0.5 text-[10px] rounded-lg bg-[#FFFFFF] dark:bg-[#18181B] hover:bg-[#FF8A8E]/20 text-zinc-700 dark:text-zinc-300 border border-[#E4E4E7] dark:border-[#27272A]"
                  title="Plus 0.50"
                >
                  +0.50
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#F21B2D]">{currency}</span>
              <input
                id="drink-price"
                type="number"
                min="0.01"
                max="5000"
                step="0.01"
                value={price || ''}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                required
                className="w-full bg-[#FFFFFF] dark:bg-[#18181B] text-[#18181B] dark:text-[#FFFFFF] tabular-nums font-extrabold tracking-[-0.02em] text-base rounded-xl px-3 py-2 border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D]"
              />
            </div>

            {/* Quick Price chips */}
            <div className="flex flex-wrap gap-1 mt-2">
              {[3.0, 3.5, 4.0, 5.0, 6.0, 7.5, 9.0].map((pVal) => (
                <button
                  key={pVal}
                  type="button"
                  onClick={() => setPrice(pVal)}
                  className={`text-[10px] px-2 py-0.5 rounded-lg font-medium transition-colors ${
                    price === pVal
                      ? 'bg-[#F21B2D] hover:bg-[#D91424] text-white font-bold'
                      : 'bg-[#FFFFFF] dark:bg-[#18181B] hover:bg-[#FF8A8E]/15 text-zinc-600 dark:text-zinc-300 border border-[#E4E4E7] dark:border-[#27272A]'
                  }`}
                >
                  {formatCurrency(pVal, currency)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Calculation Preview Banner & Add/Update Button */}
        <div className="bg-gradient-to-r from-[#FFF2F3] via-[#FFFFFF] to-[#FFF2F3] dark:from-[#121214] dark:via-[#18181B] dark:to-[#121214] rounded-xl p-3 border border-[#E4E4E7] dark:border-[#27272A] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500 dark:text-zinc-400 font-medium">Pure Alcohol:</span>
              <span className="text-[#18181B] dark:text-[#FFFFFF] font-bold text-sm tabular-nums tracking-[-0.01em]">
                {preview.pureAlcoholMl} ml ({preview.standardDrinks} std)
              </span>
            </div>

            <div className="h-4 w-px bg-[#E4E4E7] dark:bg-[#27272A]" />

            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500 dark:text-zinc-400 font-medium">KrentProcent:</span>
              <span className="text-[#F21B2D] font-extrabold text-sm tabular-nums tracking-[-0.02em]">
                {preview.pureAlcoholPerCurrency} ml / {currency}
              </span>
            </div>

            <div className="h-4 w-px bg-[#E4E4E7] dark:bg-[#27272A] hidden sm:block" />

            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-zinc-500 dark:text-zinc-400 font-medium">Cost / Std Drink:</span>
              <span className="text-[#18181B] dark:text-zinc-200 font-bold tabular-nums">
                {formatCurrency(preview.costPerStandardDrink, currency)}
              </span>
            </div>
          </div>

          <button
            type="submit"
            className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm ${
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
                <RefreshCw className="w-4 h-4 stroke-[2.5]" />
                <span>Update Existing at {resolvedBarName}</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Add &amp; Calculate</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
