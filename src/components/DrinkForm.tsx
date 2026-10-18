import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Check,
  Beer,
  Wine,
  Flame,
  GlassWater,
  Apple,
  HelpCircle,
  Store,
  AlertTriangle,
  RefreshCw,
  Copy,
} from 'lucide-react';
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

  // Find drinks from OTHER bars that match or can be quick-copied to this bar
  const otherBarSuggestions = useMemo(() => {
    const uniqueBySignature = new Map<string, DrinkItem>();
    for (const d of existingDrinks) {
      if (areBarNamesEquivalent(d.barName || DEFAULT_BAR_NAME, resolvedBarName)) continue;
      // Skip if this exact drink+volume already exists in current bar
      const alreadyInCurrentBar = findDuplicateDrinkInBar(existingDrinks, {
        name: d.name,
        barName: resolvedBarName,
        volumeMl: d.volumeMl,
        abv: d.abv,
        price: d.price,
      });
      if (alreadyInCurrentBar && alreadyInCurrentBar.matchType !== 'same_name_diff_volume') {
        continue;
      }
      const sig = `${normalizeDrinkKey(d.name)}::${Math.round(d.volumeMl)}`;
      if (!uniqueBySignature.has(sig)) {
        uniqueBySignature.set(sig, d);
      }
    }
    return Array.from(uniqueBySignature.values()).slice(0, 6);
  }, [existingDrinks, resolvedBarName]);

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
    if (volumeMl <= 0 || price <= 0 || abv <= 0) return;

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

  const categories: { id: DrinkCategory; label: string; icon: any }[] = [
    { id: 'beer', label: 'Beer', icon: Beer },
    { id: 'wine', label: 'Wine', icon: Wine },
    { id: 'spirit', label: 'Spirit', icon: Flame },
    { id: 'cocktail', label: 'Cocktail', icon: GlassWater },
    { id: 'cider', label: 'Cider', icon: Apple },
    { id: 'other', label: 'Other', icon: HelpCircle },
  ];

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header & Quick Bar Presets */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            Add Drink to Compare
          </h2>
          <p className="text-xs text-stone-400">
            Compare pure alcohol vs price for your current bar. Duplicates per bar are automatically detected.
          </p>
        </div>

        {/* 1-tap presets bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider whitespace-nowrap mr-1">
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
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-stone-800 hover:bg-amber-500/20 hover:text-amber-300 text-stone-300 border border-stone-700/80 transition-colors whitespace-nowrap"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* BAR NAME & VENUE ROW */}
        <div className="bg-stone-950/80 p-3 rounded-xl border border-stone-800 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label
              htmlFor="bar-name-input"
              className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5"
            >
              <Store className="w-3.5 h-3.5 text-amber-400" />
              <span>Which Bar are you sitting at? *</span>
            </label>

            {availableBars.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                <span className="text-[10px] text-stone-500 uppercase mr-1">Known Bars:</span>
                {availableBars.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => {
                      setBarName(b);
                      onSelectBar(b);
                    }}
                    className={`text-[10px] px-2 py-0.5 rounded font-medium border transition-colors whitespace-nowrap ${
                      areBarNamesEquivalent(barName, b)
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400/50 font-bold'
                        : 'bg-stone-900 text-stone-400 border-stone-800 hover:text-stone-200'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              id="bar-name-input"
              type="text"
              value={barName}
              onChange={(e) => setBarName(e.target.value)}
              placeholder="e.g. Café De Dokter, Gollem, The Waterhole..."
              required
              className="w-full bg-stone-900 text-white font-medium text-xs sm:text-sm rounded-lg px-3 py-2 border border-stone-700 focus:outline-none focus:border-amber-400 placeholder:text-stone-600"
            />
          </div>

          {/* Quick-copy drinks known from other bars */}
          {otherBarSuggestions.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
              <span className="text-[10px] text-stone-400 flex items-center gap-1 shrink-0">
                <Copy className="w-3 h-3 text-amber-400" />
                <span>From other bars (adjust price):</span>
              </span>
              {otherBarSuggestions.map((item) => (
                <button
                  key={`other-${item.id}`}
                  type="button"
                  onClick={() => applyPreset(item, true)}
                  title={`Copy ${item.name} (${item.volumeMl}ml, ${item.abv}%) from ${item.barName} to ${resolvedBarName}`}
                  className="text-[10px] px-2 py-0.5 rounded bg-stone-900 hover:bg-amber-500/15 text-stone-300 hover:text-amber-300 border border-stone-800 hover:border-amber-500/40 transition-colors whitespace-nowrap"
                >
                  + {item.name} ({item.volumeMl}ml)
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Drink Name, Notes & Category */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5">
            <label
              htmlFor="drink-name"
              className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5"
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
              className="w-full bg-stone-950 text-white rounded-xl px-3.5 py-2.5 text-sm border border-stone-700 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all placeholder:text-stone-600"
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="drink-notes"
              className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5"
            >
              Notes (Opt.)
            </label>
            <input
              id="drink-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Draft, Bottle"
              className="w-full bg-stone-950 text-white rounded-xl px-3 py-2.5 text-sm border border-stone-700 focus:outline-none focus:border-amber-400 transition-all placeholder:text-stone-600"
            />
          </div>

          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-stone-300 uppercase tracking-wider mb-1.5">
              Category
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-3 gap-1.5">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-[11px] font-semibold transition-all border ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-sm'
                        : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
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
              duplicateCheck.matchType === 'exact'
                ? 'bg-amber-950/50 border-amber-500/50 text-amber-200'
                : duplicateCheck.matchType === 'same_variant'
                ? 'bg-amber-950/40 border-amber-400/40 text-amber-200'
                : 'bg-stone-950/80 border-stone-700 text-stone-300'
            }`}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
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
                  className="px-2.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-700 text-[11px] font-semibold transition-colors whitespace-nowrap"
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
          <div className="bg-stone-950/70 p-3 rounded-xl border border-stone-800">
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="drink-volume" className="text-xs font-semibold text-stone-300">
                Volume (ml) *
              </label>
              <span className="text-[11px] text-amber-400 font-mono font-bold">
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
                className="w-full bg-stone-900 text-white font-mono font-bold text-base rounded-lg px-3 py-2 border border-stone-700 focus:outline-none focus:border-amber-400"
              />
              <span className="text-xs font-bold text-stone-400">ml</span>
            </div>

            {/* Quick volume chips */}
            <div className="flex flex-wrap gap-1 mt-2">
              {volumeChips.map((chip) => (
                <button
                  key={chip.val}
                  type="button"
                  onClick={() => setVolumeMl(chip.val)}
                  className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${
                    volumeMl === chip.val
                      ? 'bg-amber-500 text-stone-950 font-bold'
                      : 'bg-stone-850 hover:bg-stone-800 text-stone-300 border border-stone-700/50'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* ABV % */}
          <div className="bg-stone-950/70 p-3 rounded-xl border border-stone-800">
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="drink-abv" className="text-xs font-semibold text-stone-300">
                ABV (%) *
              </label>
              <span className="text-[11px] text-amber-400 font-mono font-bold">
                {abv ? `${abv.toFixed(1)}%` : '0%'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="drink-abv"
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={abv || ''}
                onChange={(e) => setAbv(parseFloat(e.target.value) || 0)}
                required
                className="w-full bg-stone-900 text-white font-mono font-bold text-base rounded-lg px-3 py-2 border border-stone-700 focus:outline-none focus:border-amber-400"
              />
              <span className="text-xs font-bold text-stone-400">%</span>
            </div>

            {/* Quick ABV chips */}
            <div className="flex flex-wrap gap-1 mt-2">
              {abvChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setAbv(chip)}
                  className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${
                    abv === chip
                      ? 'bg-amber-500 text-stone-950 font-bold'
                      : 'bg-stone-850 hover:bg-stone-800 text-stone-300 border border-stone-700/50'
                  }`}
                >
                  {chip}%
                </button>
              ))}
            </div>
          </div>

          {/* Price */}
          <div className="bg-stone-950/70 p-3 rounded-xl border border-stone-800">
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="drink-price" className="text-xs font-semibold text-stone-300">
                Price ({currency}) *
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPrice((p) => Math.max(0.5, Number((p - 0.5).toFixed(2))))}
                  className="px-1.5 py-0.5 text-[10px] rounded bg-stone-800 hover:bg-stone-700 text-stone-300"
                  title="Minus 0.50"
                >
                  -0.50
                </button>
                <button
                  type="button"
                  onClick={() => setPrice((p) => Number((p + 0.5).toFixed(2)))}
                  className="px-1.5 py-0.5 text-[10px] rounded bg-stone-800 hover:bg-stone-700 text-stone-300"
                  title="Plus 0.50"
                >
                  +0.50
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-400">{currency}</span>
              <input
                id="drink-price"
                type="number"
                min="0.01"
                max="5000"
                step="0.01"
                value={price || ''}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                required
                className="w-full bg-stone-900 text-white font-mono font-bold text-base rounded-lg px-3 py-2 border border-stone-700 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Quick Price chips */}
            <div className="flex flex-wrap gap-1 mt-2">
              {[3.0, 3.5, 4.0, 5.0, 6.0, 7.5, 9.0].map((pVal) => (
                <button
                  key={pVal}
                  type="button"
                  onClick={() => setPrice(pVal)}
                  className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${
                    price === pVal
                      ? 'bg-amber-500 text-stone-950 font-bold'
                      : 'bg-stone-850 hover:bg-stone-800 text-stone-300 border border-stone-700/50'
                  }`}
                >
                  {formatCurrency(pVal, currency)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Calculation Preview Banner & Add/Update Button */}
        <div className="bg-gradient-to-r from-stone-950 via-stone-900 to-stone-950 rounded-xl p-3 border border-amber-900/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-stone-400 font-medium">Pure Alcohol:</span>
              <span className="text-amber-300 font-mono font-bold text-sm">
                {preview.pureAlcoholMl} ml ({preview.standardDrinks} std)
              </span>
            </div>

            <div className="h-4 w-px bg-stone-700" />

            <div className="flex items-center gap-1.5">
              <span className="text-stone-400 font-medium">KrentProcent:</span>
              <span className="text-emerald-400 font-mono font-black text-sm">
                {preview.pureAlcoholPerCurrency} ml / {currency}
              </span>
            </div>

            <div className="h-4 w-px bg-stone-700 hidden sm:block" />

            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-stone-400 font-medium">Cost / Std Drink:</span>
              <span className="text-stone-200 font-mono font-bold">
                {formatCurrency(preview.costPerStandardDrink, currency)}
              </span>
            </div>
          </div>

          <button
            type="submit"
            className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg ${
              justAddedMessage
                ? 'bg-emerald-500 text-stone-950 shadow-emerald-500/20'
                : duplicateCheck &&
                  (duplicateCheck.matchType === 'exact' ||
                    duplicateCheck.matchType === 'same_variant')
                ? 'bg-amber-400 hover:bg-amber-300 text-stone-950 shadow-amber-500/20'
                : 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-stone-950 shadow-amber-500/20'
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
