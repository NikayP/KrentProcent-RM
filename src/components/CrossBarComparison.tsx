import React, { useState } from 'react';
import {
  DrinkItem,
  calculateBarSummaries,
  findCrossBarCommonDrinks,
  formatCurrency,
} from '../utils/calculator';
import {
  Store,
  Trophy,
  ArrowRight,
  Trash2,
  Plus,
  Pencil,
  Check,
  X,
  Beer,
  Swords,
} from 'lucide-react';

interface CrossBarComparisonProps {
  drinks: DrinkItem[];
  extraBars?: string[];
  currency: string;
  onSelectBar: (barName: string) => void;
  onAddBar?: (barName: string) => void;
  onRenameBar?: (oldName: string, newName: string) => void;
  onDeleteBar: (barName: string) => void;
  onSelectForDuel?: (drinkA: DrinkItem, drinkB: DrinkItem) => void;
}

export const CrossBarComparison: React.FC<CrossBarComparisonProps> = ({
  drinks,
  extraBars = [],
  currency,
  onSelectBar,
  onAddBar,
  onRenameBar,
  onDeleteBar,
  onSelectForDuel,
}) => {
  const [newBarName, setNewBarName] = useState('');
  const [editingBar, setEditingBar] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const summaries = calculateBarSummaries(drinks, extraBars);
  const commonDrinks = findCrossBarCommonDrinks(drinks);
  const populatedSummaries = summaries.filter((s) => s.drinkCount > 0);

  const handleAddBarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newBarName.trim();
    if (!trimmed) return;
    if (onAddBar) {
      onAddBar(trimmed);
    } else {
      onSelectBar(trimmed);
    }
    setNewBarName('');
  };

  const startRename = (barName: string) => {
    setEditingBar(barName);
    setRenameValue(barName);
  };

  const handleRenameSubmit = (e: React.FormEvent, oldName: string) => {
    e.preventDefault();
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== oldName && onRenameBar) {
      onRenameBar(oldName, trimmed);
    }
    setEditingBar(null);
  };

  if (summaries.length === 0) {
    return (
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-8 text-center space-y-4">
        <Store className="w-12 h-12 text-amber-400 mx-auto mb-2 opacity-60" />
        <h3 className="text-lg font-bold text-white">No Bars Recorded Yet</h3>
        <p className="text-sm text-stone-400 max-w-sm mx-auto">
          Create your first bar below, or add drinks with their bar name to compare prices across
          different bars and pubs.
        </p>
        {onAddBar && (
          <form
            onSubmit={handleAddBarSubmit}
            className="flex items-center justify-center gap-2 max-w-sm mx-auto pt-2"
          >
            <input
              type="text"
              value={newBarName}
              onChange={(e) => setNewBarName(e.target.value)}
              placeholder="e.g. Café De Dokter..."
              className="flex-1 bg-stone-950 text-white text-xs sm:text-sm rounded-xl px-3.5 py-2 border border-stone-700 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs sm:text-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Bar</span>
            </button>
          </form>
        )}
      </div>
    );
  }

  const cheapestBar =
    populatedSummaries.length > 0
      ? [...populatedSummaries].sort(
          (a, b) => a.averageStandardDrinkCost - b.averageStandardDrinkCost
        )[0]
      : null;

  const highestValueBar = populatedSummaries[0] || null;

  return (
    <div className="space-y-6">
      {/* Overview & Bar Management Banner */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                <Store className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-black text-white">
                Bar Management &amp; Cross-Bar Comparison
              </h2>
            </div>
            <p className="text-xs text-stone-400 mt-1">
              Manage your recorded venues ({summaries.length}), rename or merge bars, and see which
              pub delivers the most alcohol for your money.
            </p>
          </div>

          {/* Add New Bar Form */}
          {onAddBar && (
            <form onSubmit={handleAddBarSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={newBarName}
                onChange={(e) => setNewBarName(e.target.value)}
                placeholder="New bar / venue name..."
                className="bg-stone-950 text-white text-xs rounded-xl px-3 py-2 border border-stone-700 focus:outline-none focus:border-amber-400 w-48 sm:w-56"
              />
              <button
                type="submit"
                disabled={!newBarName.trim()}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-stone-950 font-bold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Add Bar</span>
              </button>
            </form>
          )}
        </div>

        {/* Quick Highlights */}
        {highestValueBar && cheapestBar && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-stone-800">
            <div className="bg-stone-950/70 p-3.5 rounded-xl border border-stone-800/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  🏆 Best Alcohol Value Venue
                </span>
                <h4 className="text-base font-black text-white">{highestValueBar.barName}</h4>
                <p className="text-xs text-stone-400">
                  Avg:{' '}
                  <span className="text-amber-300 font-mono font-bold">
                    {highestValueBar.averageKrentScore} ml / {currency}
                  </span>
                </p>
              </div>
              <button
                onClick={() => onSelectBar(highestValueBar.barName)}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1 transition-colors"
              >
                <span>View Bar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-stone-950/70 p-3.5 rounded-xl border border-stone-800/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  💰 Cheapest Standard Drink
                </span>
                <h4 className="text-base font-black text-white">{cheapestBar.barName}</h4>
                <p className="text-xs text-stone-400">
                  Avg Std Drink:{' '}
                  <span className="text-emerald-400 font-mono font-bold">
                    {formatCurrency(cheapestBar.averageStandardDrinkCost, currency)}
                  </span>
                </p>
              </div>
              <button
                onClick={() => onSelectBar(cheapestBar.barName)}
                className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs flex items-center gap-1 transition-colors"
              >
                <span>View Bar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bar Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {summaries.map((summary, idx) => {
          const isTop = idx === 0 && summary.drinkCount > 0;
          const isBeingRenamed = editingBar === summary.barName;

          return (
            <div
              key={summary.barName}
              className={`rounded-2xl p-5 border flex flex-col justify-between transition-all ${
                isTop
                  ? 'bg-gradient-to-b from-stone-900 to-amber-950/30 border-amber-400/70 shadow-lg ring-1 ring-amber-400/20'
                  : 'bg-stone-900/90 border-stone-800 hover:border-stone-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold bg-stone-800 px-2.5 py-0.5 rounded-full text-stone-300 whitespace-nowrap shrink-0">
                    {summary.drinkCount > 0 ? `#${idx + 1} Venue` : 'Empty Venue'}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isTop && (
                      <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-stone-950 px-2 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap shrink-0">
                        <Trophy className="w-3 h-3" /> Best Value
                      </span>
                    )}
                    {onRenameBar && (
                      <button
                        type="button"
                        onClick={() => startRename(summary.barName)}
                        title={`Rename or merge ${summary.barName}`}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-amber-300 hover:bg-stone-800 border border-stone-800 transition-colors"
                        aria-label={`Rename bar ${summary.barName}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteBar(summary.barName)}
                      title={`Delete ${summary.barName} and all its drinks`}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-rose-400 hover:bg-rose-950/60 border border-stone-800 hover:border-rose-800 transition-colors"
                      aria-label={`Delete bar ${summary.barName}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isBeingRenamed ? (
                  <form
                    onSubmit={(e) => handleRenameSubmit(e, summary.barName)}
                    className="space-y-1.5 my-2"
                  >
                    <label className="block text-[10px] text-amber-300 uppercase font-bold">
                      Rename Bar (or type existing bar name to merge):
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        autoFocus
                        className="flex-1 bg-stone-950 text-white text-xs font-bold rounded-lg px-2.5 py-1.5 border border-amber-400 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="p-1.5 rounded-lg bg-amber-500 text-stone-950 hover:bg-amber-400"
                        title="Save new bar name"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingBar(null)}
                        className="p-1.5 rounded-lg bg-stone-800 text-stone-300 hover:text-white"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                ) : (
                  <h3 className="text-lg font-black text-white">{summary.barName}</h3>
                )}

                <p className="text-xs text-stone-400 font-medium">
                  {summary.drinkCount} {summary.drinkCount === 1 ? 'drink' : 'drinks'} logged
                </p>

                {summary.drinkCount > 0 ? (
                  <div className="mt-4 space-y-2.5 text-xs">
                    <div className="bg-stone-950/60 p-2.5 rounded-xl border border-stone-800/80 flex items-center justify-between">
                      <span className="text-stone-400">Avg Krent Score:</span>
                      <span className="text-amber-400 font-mono font-bold text-sm">
                        {summary.averageKrentScore} ml / {currency}
                      </span>
                    </div>

                    <div className="bg-stone-950/60 p-2.5 rounded-xl border border-stone-800/80 flex items-center justify-between">
                      <span className="text-stone-400">Avg Std Drink Cost:</span>
                      <span className="text-stone-200 font-mono font-bold">
                        {formatCurrency(summary.averageStandardDrinkCost, currency)}
                      </span>
                    </div>

                    {summary.bestDrink && (
                      <div className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 text-xs">
                        <div className="text-[10px] text-amber-300 font-bold uppercase">
                          Best Deal at this Bar:
                        </div>
                        <div className="font-bold text-white truncate mt-0.5">
                          {summary.bestDrink.name}
                        </div>
                        <div className="text-[11px] text-stone-300 font-mono mt-0.5 flex items-center justify-between">
                          <span>
                            {summary.bestDrink.volumeMl}ml &bull; {summary.bestDrink.abv}% &bull;{' '}
                            {formatCurrency(summary.bestDrink.price, currency)}
                          </span>
                          <span className="text-amber-400 font-bold">
                            {summary.bestDrink.pureAlcoholPerCurrency} ml/{currency}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 p-4 rounded-xl bg-stone-950/50 border border-dashed border-stone-800 text-center text-xs text-stone-400">
                    No drinks added to this bar yet. Click below to add drinks or scan its menu.
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => onSelectBar(summary.barName)}
                  className="flex-1 py-2.5 rounded-xl bg-stone-800 hover:bg-amber-500 hover:text-stone-950 text-stone-200 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>
                    {summary.drinkCount > 0
                      ? `Open ${summary.barName}`
                      : `Add Drinks to ${summary.barName}`}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteBar(summary.barName)}
                  title={`Delete ${summary.barName}`}
                  className="p-2.5 rounded-xl bg-stone-850 hover:bg-rose-950/60 text-stone-400 hover:text-rose-400 border border-stone-800 hover:border-rose-800 transition-colors"
                  aria-label={`Remove bar ${summary.barName}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Same Drink Across Multiple Bars Comparison */}
      {commonDrinks.length > 0 && (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Beer className="w-5 h-5" />
                </span>
                <h3 className="text-base sm:text-lg font-black text-white">
                  Same Drink Across Multiple Bars
                </h3>
              </div>
              <p className="text-xs text-stone-400 mt-1">
                A classic beer is served at many venues — see where your favorite drink is cheapest
                and delivers the highest KrentProcent score!
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {commonDrinks.map((group) => (
              <div
                key={group.groupKey}
                className="bg-stone-950/70 border border-stone-800 rounded-2xl p-4 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-black text-white">{group.displayName}</h4>
                      <span className="text-[11px] text-stone-400 font-mono">
                        {group.volumeMl}ml ({Number((group.volumeMl / 10).toFixed(0))}cl) &bull;{' '}
                        {group.abv}% ABV &bull; Found at {group.entries.length} bars
                      </span>
                    </div>

                    {group.maxPriceDifference > 0 && (
                      <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                        Save {formatCurrency(group.maxPriceDifference, currency)} / glass
                      </span>
                    )}
                  </div>

                  <div className="mt-3 space-y-1.5">
                    {group.entries.map((entry, i) => {
                      const isCheapest = i === 0;
                      return (
                        <div
                          key={entry.id}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs border ${
                            isCheapest
                              ? 'bg-amber-500/10 border-amber-500/40 text-white'
                              : 'bg-stone-900/70 border-stone-800/80 text-stone-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                isCheapest
                                  ? 'bg-amber-400 text-stone-950'
                                  : 'bg-stone-800 text-stone-400'
                              }`}
                            >
                              #{i + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => entry.barName && onSelectBar(entry.barName)}
                              className="font-bold truncate hover:text-amber-300 transition-colors text-left"
                            >
                              📍 {entry.barName}
                            </button>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 font-mono">
                            <span
                              className={
                                isCheapest ? 'text-emerald-400 font-bold' : 'text-stone-300'
                              }
                            >
                              {formatCurrency(entry.price, currency)}
                            </span>
                            <span className="text-amber-400 font-bold">
                              {entry.pureAlcoholPerCurrency} ml/{currency}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {onSelectForDuel && group.entries.length >= 2 && (
                  <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-stone-400">
                      Best at <strong className="text-amber-300">{group.bestEntry.barName}</strong>{' '}
                      ({group.maxValueAdvantagePercent > 0 ? `+${group.maxValueAdvantagePercent}% value` : 'equal value'})
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectForDuel(group.bestEntry, group.worstEntry)}
                      className="text-amber-300 hover:text-amber-200 font-bold flex items-center gap-1"
                    >
                      <Swords className="w-3.5 h-3.5" />
                      <span>1v1 Duel Bars</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
