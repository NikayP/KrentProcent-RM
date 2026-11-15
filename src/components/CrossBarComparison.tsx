import React, { useState } from 'react';
import {
  DrinkItem,
  calculateBarSummaries,
  findCrossBarCommonDrinks,
  formatCurrency,
  normalizeBarKey,
} from '../utils/calculator';
import type { BarShareInfo } from '../hooks/usePublicBarsSync';
import { ConfirmModal } from './ConfirmModal';
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
  MapPin,
  Lock,
  Globe,
  Loader2,
} from 'lucide-react';

interface CrossBarComparisonProps {
  drinks: DrinkItem[];
  extraBars?: string[];
  currency: string;
  onSelectBar: (barName: string) => void;
  onAddBar?: (barName: string) => void;
  onRenameBar?: (oldName: string, newName: string) => void;
  onDeleteBar: (barName: string) => void;
  canShare?: boolean;
  shareState?: Record<string, BarShareInfo>;
  updatingBarKey?: string | null;
  onSetBarPublic?: (barName: string, isPublic: boolean, city: string | null) => void;
  onPromptLogin?: () => void;
  accountDisplayName?: string | null;
}

export const CrossBarComparison: React.FC<CrossBarComparisonProps> = ({
  drinks,
  extraBars = [],
  currency,
  onSelectBar,
  onAddBar,
  onRenameBar,
  onDeleteBar,
  canShare = false,
  shareState = {},
  updatingBarKey = null,
  onSetBarPublic,
  onPromptLogin,
  accountDisplayName,
}) => {
  const [newBarName, setNewBarName] = useState('');
  const [editingBar, setEditingBar] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [pendingPublicBar, setPendingPublicBar] = useState<string | null>(null);
  const [cityDrafts, setCityDrafts] = useState<Record<string, string>>({});

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
      <div className="bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl p-8 text-center space-y-4 shadow-sm">
        <Store className="w-12 h-12 text-[#F21B2D] mx-auto mb-2 opacity-80" />
        <h3 className="text-lg font-bold text-[#18181B] dark:text-[#FFFFFF]">No Bars Recorded Yet</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
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
              className="flex-1 bg-[#FFF2F3]/50 dark:bg-[#121214] text-[#18181B] dark:text-[#FFFFFF] text-xs sm:text-sm rounded-xl px-3.5 py-2 border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D]"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#F21B2D] hover:bg-[#D91424] text-white font-bold text-xs sm:text-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Bar</span>
            </button>
          </form>
        )}
      </div>
    );
  }

  const highestValueBar = populatedSummaries[0] || null;

  return (
    <div className="space-y-6">
      {/* Overview & Bar Management Banner */}
      <div className="bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-[#FF8A8E]/20 text-[#F21B2D]">
                <Store className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-extrabold tracking-[-0.03em] text-[#18181B] dark:text-[#FFFFFF]">
                Bar Management &amp; Cross-Bar Comparison
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Manage your recorded venues ({summaries.length}), rename or merge bars, and see which
              pub delivers the most alcohol for your money.
            </p>
            {!canShare && onPromptLogin && (
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5">
                <button
                  type="button"
                  onClick={onPromptLogin}
                  className="font-semibold text-[#F21B2D] hover:underline"
                >
                  Log in
                </button>{' '}
                to share your bars with friends.
              </p>
            )}
          </div>

          {/* Add New Bar Form */}
          {onAddBar && (
            <form onSubmit={handleAddBarSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={newBarName}
                onChange={(e) => setNewBarName(e.target.value)}
                placeholder="New bar / venue name..."
                className="bg-[#FFF2F3]/50 dark:bg-[#121214] text-[#18181B] dark:text-[#FFFFFF] text-xs rounded-xl px-3 py-2 border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D] w-48 sm:w-56"
              />
              <button
                type="submit"
                disabled={!newBarName.trim()}
                className="px-3.5 py-2 rounded-xl bg-[#F21B2D] hover:bg-[#D91424] disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Add Bar</span>
              </button>
            </form>
          )}
        </div>

        {/* Quick Highlight */}
        {highestValueBar && (
          <div className="pt-3 border-t border-[#E4E4E7] dark:border-[#27272A]">
            <div className="bg-[#FFF2F3]/60 dark:bg-[#121214] p-3.5 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#F21B2D] inline-flex items-center gap-1">
                  <Trophy className="w-3 h-3 shrink-0" />
                  <span>Best Alcohol Value Venue</span>
                </span>
                <h4 className="text-base font-extrabold tracking-[-0.02em] text-[#18181B] dark:text-[#FFFFFF] truncate">{highestValueBar.barName}</h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Avg:{' '}
                  <span className="text-[#F21B2D] font-bold tabular-nums">
                    {highestValueBar.averageKrentScore} ml / {currency}
                  </span>
                </p>
              </div>
              <button
                onClick={() => onSelectBar(highestValueBar.barName)}
                className="px-3 py-1.5 rounded-xl bg-[#F21B2D] hover:bg-[#D91424] text-white font-bold text-xs flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
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
          const barKey = normalizeBarKey(summary.barName);
          const shareInfo = shareState[barKey];
          const isPublic = Boolean(shareInfo?.isPublic);
          const isUpdatingShare = updatingBarKey === barKey;
          const cityValue =
            cityDrafts[barKey] !== undefined ? cityDrafts[barKey] : shareInfo?.city || '';
          const savedCity = shareInfo?.city || '';
          const cityChanged = cityValue.trim() !== savedCity;

          return (
            <div
              key={summary.barName}
              className={`rounded-2xl p-5 border flex flex-col justify-between transition-all shadow-sm ${
                isTop
                  ? 'bg-gradient-to-b from-[#FFFFFF] to-[#FFF2F3] dark:from-[#18181B] dark:to-[#F21B2D]/10 border-[#F21B2D]/70 ring-1 ring-[#F21B2D]/20'
                  : 'bg-[#FFFFFF] dark:bg-[#18181B] border-[#E4E4E7] dark:border-[#27272A] hover:border-[#FF8A8E] dark:hover:border-[#FF8A8E]/50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs tabular-nums font-bold bg-[#FFF2F3] dark:bg-[#121214] border border-[#E4E4E7] dark:border-[#27272A] px-2.5 py-0.5 rounded-full text-zinc-600 dark:text-zinc-300 whitespace-nowrap shrink-0">
                    {summary.drinkCount > 0 ? `#${idx + 1} Venue` : 'Empty Venue'}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isTop && (
                      <span className="text-[10px] font-extrabold uppercase tracking-wider bg-[#F21B2D] text-white px-2 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap shrink-0">
                        <Trophy className="w-3 h-3" /> Best Value
                      </span>
                    )}
                    {onRenameBar && (
                      <button
                        type="button"
                        onClick={() => startRename(summary.barName)}
                        title={`Rename or merge ${summary.barName}`}
                        className="p-1.5 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-[#F21B2D] hover:bg-[#FFF2F3] dark:hover:bg-[#121214] border border-[#E4E4E7] dark:border-[#27272A] transition-colors"
                        aria-label={`Rename bar ${summary.barName}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteBar(summary.barName)}
                      title={`Delete ${summary.barName} and all its drinks`}
                      className="p-1.5 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-white hover:bg-[#F21B2D] border border-[#E4E4E7] dark:border-[#27272A] hover:border-[#F21B2D] transition-colors"
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
                    <label className="block text-[10px] text-[#F21B2D] uppercase font-bold">
                      Rename Bar (or type existing bar name to merge):
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        autoFocus
                        className="flex-1 bg-[#FFF2F3]/50 dark:bg-[#121214] text-[#18181B] dark:text-[#FFFFFF] text-xs font-bold rounded-xl px-2.5 py-1.5 border border-[#F21B2D] focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="p-1.5 rounded-xl bg-[#F21B2D] text-white hover:bg-[#D91424]"
                        title="Save new bar name"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingBar(null)}
                        className="p-1.5 rounded-xl bg-[#FFF2F3] dark:bg-[#121214] text-zinc-500 dark:text-zinc-300 hover:text-[#18181B] dark:hover:text-white border border-[#E4E4E7] dark:border-[#27272A]"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                ) : (
                  <h3 className="text-lg font-extrabold tracking-[-0.03em] text-[#18181B] dark:text-[#FFFFFF]">{summary.barName}</h3>
                )}

                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  {summary.drinkCount} {summary.drinkCount === 1 ? 'drink' : 'drinks'} logged
                </p>

                {summary.drinkCount > 0 ? (
                  <div className="mt-4 space-y-2.5 text-xs">
                    <div className="bg-[#FFF2F3]/60 dark:bg-[#121214] p-2.5 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between">
                      <span className="text-zinc-500 dark:text-zinc-400">Avg Krent Score:</span>
                      <span className="text-[#F21B2D] font-extrabold tracking-[-0.02em] text-sm tabular-nums">
                        {summary.averageKrentScore} ml / {currency}
                      </span>
                    </div>

                    {summary.bestDrink && (
                      <div className="bg-[#FF8A8E]/15 p-2.5 rounded-xl border border-[#FF8A8E]/40 text-xs">
                        <div className="text-[10px] text-[#D91424] dark:text-[#FF8A8E] font-bold uppercase">
                          Best Deal at this Bar:
                        </div>
                        <div className="font-bold text-[#18181B] dark:text-[#FFFFFF] truncate mt-0.5">
                          {summary.bestDrink.name}
                        </div>
                        <div className="text-[11px] text-zinc-600 dark:text-zinc-300 tabular-nums mt-0.5 flex items-center justify-between">
                          <span>
                            {summary.bestDrink.volumeMl}ml &bull; {summary.bestDrink.abv}% &bull;{' '}
                            {formatCurrency(summary.bestDrink.price, currency)}
                          </span>
                          <span className="text-[#F21B2D] font-bold tabular-nums">
                            {summary.bestDrink.pureAlcoholPerCurrency} ml/{currency}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 p-4 rounded-xl bg-[#FFF2F3]/40 dark:bg-[#121214] border border-dashed border-[#E4E4E7] dark:border-[#27272A] text-center text-xs text-zinc-500 dark:text-zinc-400">
                    No drinks added to this bar yet. Click below to add drinks or scan its menu.
                  </div>
                )}
              </div>

              {/* Sharing Controls (logged-in users) */}
              {canShare && onSetBarPublic && (
                <div className="mt-3 pt-3 border-t border-[#E4E4E7] dark:border-[#27272A] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                      Visibility
                    </span>
                    <button
                      type="button"
                      disabled={isUpdatingShare}
                      onClick={() => {
                        if (isPublic) {
                          onSetBarPublic(summary.barName, false, null);
                        } else {
                          setPendingPublicBar(summary.barName);
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors disabled:opacity-50 ${
                        isPublic
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/35 hover:bg-emerald-500/25'
                          : 'bg-[#FFF2F3] dark:bg-[#121214] text-zinc-600 dark:text-zinc-300 border-[#E4E4E7] dark:border-[#27272A] hover:border-[#F21B2D]/40'
                      }`}
                    >
                      {isUpdatingShare ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : isPublic ? (
                        <Globe className="w-3 h-3" />
                      ) : (
                        <Lock className="w-3 h-3" />
                      )}
                      <span>{isPublic ? 'Public' : 'Private'}</span>
                    </button>
                  </div>

                  {isPublic && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        onSetBarPublic(summary.barName, true, cityValue);
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <input
                        type="text"
                        value={cityValue}
                        maxLength={60}
                        onChange={(e) =>
                          setCityDrafts((prev) => ({
                            ...prev,
                            [barKey]: e.target.value,
                          }))
                        }
                        placeholder="City (optional, e.g. Utrecht)"
                        aria-label={`City for ${summary.barName}`}
                        className="flex-1 min-w-0 bg-[#FFF2F3]/50 dark:bg-[#121214] text-[#18181B] dark:text-white text-xs rounded-xl px-2.5 py-1.5 border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D]"
                      />
                      {cityChanged && (
                        <button
                          type="submit"
                          disabled={isUpdatingShare}
                          className="px-2.5 py-1.5 rounded-xl bg-[#F21B2D] hover:bg-[#D91424] text-white text-[11px] font-bold transition-colors shrink-0"
                        >
                          Save
                        </button>
                      )}
                    </form>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => onSelectBar(summary.barName)}
                  className="flex-1 py-2.5 rounded-xl bg-[#FFF2F3] dark:bg-[#121214] hover:bg-[#F21B2D] hover:text-white text-[#18181B] dark:text-zinc-200 border border-[#E4E4E7] dark:border-[#27272A] hover:border-[#F21B2D] font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
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
                  className="p-2.5 rounded-xl bg-[#FFF2F3] dark:bg-[#121214] hover:bg-[#F21B2D] text-zinc-500 dark:text-zinc-400 hover:text-white border border-[#E4E4E7] dark:border-[#27272A] hover:border-[#F21B2D] transition-colors"
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
        <div className="bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-[#FF8A8E]/20 text-[#F21B2D]">
                  <Beer className="w-5 h-5" />
                </span>
                <h3 className="text-base sm:text-lg font-extrabold tracking-[-0.03em] text-[#18181B] dark:text-[#FFFFFF]">
                  Same Drink Across Multiple Bars
                </h3>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                A classic beer is served at many venues — see where your favorite drink is cheapest
                and delivers the highest KrentProcent score!
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {commonDrinks.map((group) => (
              <div
                key={group.groupKey}
                className="bg-[#FFF2F3]/50 dark:bg-[#121214] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl p-4 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-extrabold tracking-[-0.02em] text-[#18181B] dark:text-[#FFFFFF]">{group.displayName}</h4>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                        {group.volumeMl}ml ({Number((group.volumeMl / 10).toFixed(0))}cl) &bull;{' '}
                        {group.abv}% ABV &bull; Found at {group.entries.length} bars
                      </span>
                    </div>

                    {group.maxPriceDifference > 0 && (
                      <span className="text-[10px] font-bold bg-[#FF8A8E]/20 text-[#D91424] dark:text-[#FF8A8E] border border-[#FF8A8E]/40 px-2 py-0.5 rounded-full whitespace-nowrap">
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
                              ? 'bg-[#FF8A8E]/15 border-[#F21B2D]/40 text-[#18181B] dark:text-[#FFFFFF]'
                              : 'bg-[#FFFFFF] dark:bg-[#18181B] border-[#E4E4E7] dark:border-[#27272A] text-zinc-600 dark:text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`text-[10px] tabular-nums font-bold px-1.5 py-0.5 rounded-lg ${
                                isCheapest
                                  ? 'bg-[#F21B2D] text-white'
                                  : 'bg-[#FFF2F3] dark:bg-[#121214] text-zinc-500 dark:text-zinc-400 border border-[#E4E4E7] dark:border-[#27272A]'
                              }`}
                            >
                              #{i + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => entry.barName && onSelectBar(entry.barName)}
                              className="font-bold truncate hover:text-[#F21B2D] transition-colors text-left inline-flex items-center gap-1.5 min-w-0"
                            >
                              <MapPin className="w-3 h-3 text-[#F21B2D] shrink-0" />
                              <span className="truncate">{entry.barName}</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 tabular-nums">
                            <span
                              className={
                                isCheapest ? 'text-[#18181B] dark:text-[#FFFFFF] font-bold' : 'text-zinc-600 dark:text-zinc-300'
                              }
                            >
                              {formatCurrency(entry.price, currency)}
                            </span>
                            <span className="text-[#F21B2D] font-bold">
                              {entry.pureAlcoholPerCurrency} ml/{currency}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {group.entries.length >= 2 && (
                  <div className="pt-2 border-t border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between text-[11px]">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      Best at <strong className="text-[#F21B2D]">{group.bestEntry.barName}</strong>{' '}
                      ({group.maxValueAdvantagePercent > 0 ? `+${group.maxValueAdvantagePercent}% value` : 'equal value'})
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <ConfirmModal
        isOpen={Boolean(pendingPublicBar)}
        title={`Share "${pendingPublicBar}" Publicly?`}
        message={`Anyone can see this bar's drinks and prices, together with your username${
          accountDisplayName ? ` @${accountDisplayName.replace(/^@/, '')}` : ''
        }.`}
        confirmLabel="Make Public"
        cancelLabel="Cancel"
        variant="primary"
        onConfirm={() => {
          if (pendingPublicBar && onSetBarPublic) {
            const key = normalizeBarKey(pendingPublicBar);
            onSetBarPublic(pendingPublicBar, true, cityDrafts[key] ?? null);
          }
          setPendingPublicBar(null);
        }}
        onCancel={() => setPendingPublicBar(null)}
      />
    </div>
  );
};
