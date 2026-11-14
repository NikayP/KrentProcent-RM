import React, { useState, useMemo } from 'react';
import {
  DrinkItem,
  CalculatedDrink,
  rankDrinks,
  formatCurrency,
  filterDrinksByBar,
  normalizeDrinkKey,
  normalizeBarKey,
  DEFAULT_BAR_NAME,
} from '../utils/calculator';
import { DrinkCard } from './DrinkCard';
import {
  ArrowUpDown,
  Filter,
  Sparkles,
  Trophy,
  Share2,
  Check,
  Beer,
  Store,
  Trash2,
  Search,
  Globe,
} from 'lucide-react';
import { CategoryIcon, DRINK_CATEGORY_META } from './CategoryIcon';

interface LeaderboardProps {
  drinks: DrinkItem[];
  currency: string;
  onDeleteDrink: (id: string) => void;
  onUpdateDrink?: (drink: DrinkItem) => void;
  onLoadPresets: () => void;
  activeBar: string;
  onSelectBar: (bar: string) => void;
  onDeleteBar: (bar: string) => void;
  availableBars: string[];
}

type SortOption = 'krent' | 'price' | 'abv' | 'alcohol';

export const Leaderboard: React.FC<LeaderboardProps> = ({
  drinks,
  currency,
  onDeleteDrink,
  onUpdateDrink,
  onLoadPresets,
  activeBar,
  onSelectBar,
  onDeleteBar,
  availableBars,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('krent');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Map of (normalizedDrinkKey::volumeMl) -> Set of normalizedBarKeys across the entire database
  const crossBarPresenceMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const d of drinks) {
      const sig = `${normalizeDrinkKey(d.name)}::${Math.round(d.volumeMl)}`;
      const barKey = normalizeBarKey(d.barName || DEFAULT_BAR_NAME);
      const set = map.get(sig) || new Set<string>();
      set.add(barKey);
      map.set(sig, set);
    }
    return map;
  }, [drinks]);

  // Filter drinks to active bar first, or all
  const barScopedDrinks = useMemo(() => {
    return filterDrinksByBar(drinks, activeBar);
  }, [drinks, activeBar]);

  // Calculate and rank the bar-scoped drinks
  const ranked = useMemo(() => rankDrinks(barScopedDrinks), [barScopedDrinks]);

  // Apply category, search, and sort
  const filtered = useMemo(() => {
    let list = [...ranked];
    if (selectedCategory !== 'all') {
      list = list.filter((d) => d.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          (d.barName && d.barName.toLowerCase().includes(q)) ||
          (d.notes && d.notes.toLowerCase().includes(q))
      );
    }

    if (sortBy === 'price') {
      list.sort((a, b) => a.price - b.price || b.pureAlcoholPerCurrency - a.pureAlcoholPerCurrency);
    } else if (sortBy === 'abv') {
      list.sort((a, b) => b.abv - a.abv || b.pureAlcoholPerCurrency - a.pureAlcoholPerCurrency);
    } else if (sortBy === 'alcohol') {
      list.sort(
        (a, b) => b.pureAlcoholMl - a.pureAlcoholMl || b.pureAlcoholPerCurrency - a.pureAlcoholPerCurrency
      );
    }

    return list;
  }, [ranked, selectedCategory, searchQuery, sortBy]);

  const bestOverall = ranked[0];
  const worstOverall = ranked[ranked.length - 1];

  const handleShare = () => {
    if (ranked.length === 0) return;
    const barLabel = activeBar === 'all' ? 'All Bars' : activeBar;
    const summary = ranked
      .map(
        (d, i) =>
          `#${i + 1}: ${d.name} [${d.barName}] (${d.volumeMl}ml, ${d.abv}%, ${formatCurrency(
            d.price,
            currency
          )}) -> ${d.pureAlcoholPerCurrency} ml/${currency}`
      )
      .join('\n');
    const text = `🍺 KrentProcent RM Bar Value Ranking (${barLabel}):\n${summary}\n\nWinner: ${bestOverall?.name} (${bestOverall?.pureAlcoholPerCurrency} ml/${currency})`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (drinks.length === 0 && availableBars.length === 0) {
    return (
      <div className="bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl p-8 text-center shadow-sm">
        <div className="w-16 h-16 bg-[#FF8A8E]/20 border border-[#FF8A8E]/40 rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#F21B2D]">
          <Beer className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-[#18181B] dark:text-[#FFFFFF] mb-2">No Drinks Added Yet</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-6">
          Use the form above to add a beer or drink for your current bar, or load our authentic pub
          drinks preset to compare immediately.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onLoadPresets}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#F21B2D] hover:bg-[#D91424] text-white font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Load Authentic Amsterdam Pub Drinks</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Active Bar Context Banner */}
      <div id="tour-leaderboard-banner" className="bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#FF8A8E]/20 text-[#F21B2D] flex items-center justify-center shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Current Menu Focus:
              </span>
              <span className="text-sm font-extrabold tracking-[-0.02em] text-[#D91424] dark:text-[#FF8A8E] bg-[#FF8A8E]/20 px-2 py-0.5 rounded-lg border border-[#FF8A8E]/40">
                {activeBar === 'all' ? 'All Bars (Global)' : activeBar}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {activeBar === 'all'
                ? `Showing ${ranked.length} drinks across ${availableBars.length} venues.`
                : `Showing ${ranked.length} ${ranked.length === 1 ? 'drink' : 'drinks'} specifically at ${activeBar}.`}
            </p>
          </div>
        </div>

        {/* Quick switch to all bars or other bars */}
        <div className="flex items-center gap-2 shrink-0">
          {activeBar !== 'all' ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSelectBar('all')}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#FFF2F3] dark:bg-[#121214] hover:bg-[#FF8A8E]/20 text-[#18181B] dark:text-zinc-200 border border-[#E4E4E7] dark:border-[#27272A] transition-colors inline-flex items-center gap-1.5"
              >
                <Globe className="w-3.5 h-3.5 text-[#F21B2D] shrink-0" />
                <span>View All Bars</span>
              </button>

              <button
                type="button"
                onClick={() => onDeleteBar(activeBar)}
                title={`Delete ${activeBar} and all of its drinks`}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-[#FFFFFF] dark:bg-[#121214] hover:bg-[#FF8A8E]/15 text-zinc-500 dark:text-zinc-400 hover:text-[#F21B2D] border border-[#E4E4E7] dark:border-[#27272A] hover:border-[#F21B2D]/40 transition-colors flex items-center gap-1.5"
                aria-label={`Delete bar ${activeBar}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Delete Bar</span>
              </button>
            </div>
          ) : (
            availableBars.length > 0 && (
              <select
                value={activeBar}
                onChange={(e) => onSelectBar(e.target.value)}
                className="bg-[#FFF2F3] dark:bg-[#121214] text-[#18181B] dark:text-zinc-200 text-xs font-semibold rounded-xl px-2.5 py-1.5 border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D]"
              >
                <option value="all">All Bars</option>
                {availableBars.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            )
          )}
        </div>
      </div>

      {/* Top Winner Insight Banner for Current Bar */}
      {bestOverall && ranked.length > 1 && (
        <div className="bg-gradient-to-r from-[#FF8A8E]/25 via-[#FFFFFF] to-[#FFF2F3] dark:from-[#F21B2D]/15 dark:via-[#18181B] dark:to-[#18181B] border border-[#F21B2D]/40 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-[#F21B2D] flex items-center justify-center text-white shadow-sm shrink-0">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-[#F21B2D] uppercase tracking-widest">
                {activeBar === 'all' ? 'Overall #1 Recommendation' : `#1 Deal at ${activeBar}`}
              </div>
              <h3 className="text-lg font-extrabold tracking-[-0.03em] text-[#18181B] dark:text-[#FFFFFF]">
                {bestOverall.name}{' '}
                <span className="text-[#F21B2D] font-semibold tabular-nums tracking-[-0.01em]">
                  ({bestOverall.pureAlcoholPerCurrency} ml alcohol per {currency})
                </span>
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-0.5">
                {worstOverall && worstOverall.id !== bestOverall.id ? (
                  <>
                    Gives you{' '}
                    <span className="font-bold text-[#F21B2D]">
                      +{Math.abs(worstOverall.percentageRelativeToBest || 0).toFixed(0)}% more
                      alcohol per {currency}
                    </span>{' '}
                    compared to {worstOverall.name}.
                  </>
                ) : (
                  'Best mathematical value at this bar right now.'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleShare}
              className="px-3.5 py-2 rounded-xl bg-[#FFFFFF] dark:bg-[#121214] hover:bg-[#FFF2F3] dark:hover:bg-[#27272A] text-[#18181B] dark:text-zinc-200 border border-[#E4E4E7] dark:border-[#27272A] text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-[#F21B2D]" />
                  <span>Share Board</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Filter, Search & Sort Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[#FFFFFF] dark:bg-[#18181B] p-3 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] shadow-sm">
        {/* Category Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-zinc-400 mr-1 shrink-0" />
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              selectedCategory === 'all'
                ? 'bg-[#F21B2D] hover:bg-[#D91424] text-white font-bold shadow-sm'
                : 'bg-[#FFF2F3]/70 dark:bg-[#121214] hover:bg-[#FF8A8E]/20 text-zinc-600 dark:text-zinc-300 border border-[#E4E4E7] dark:border-[#27272A]'
            }`}
          >
            All Drinks
          </button>
          {(['beer', 'wine', 'spirit', 'cocktail', 'cider'] as const).map((catId) => {
            const isSelected = selectedCategory === catId;
            return (
              <button
                key={catId}
                onClick={() => setSelectedCategory(catId)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap inline-flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#F21B2D] hover:bg-[#D91424] text-white font-bold shadow-sm'
                    : 'bg-[#FFF2F3]/70 dark:bg-[#121214] hover:bg-[#FF8A8E]/20 text-zinc-600 dark:text-zinc-300 border border-[#E4E4E7] dark:border-[#27272A]'
                }`}
              >
                <CategoryIcon
                  category={catId}
                  className="w-3.5 h-3.5"
                  colored={!isSelected}
                />
                <span>{DRINK_CATEGORY_META[catId].filterLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Search & Sort Selector */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search drink..."
              className="w-full sm:w-40 bg-[#FFF2F3]/60 dark:bg-[#121214] text-[#18181B] dark:text-[#FFFFFF] text-xs rounded-xl pl-8 pr-2.5 py-1.5 border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D] placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium hidden sm:inline">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-[#FFF2F3]/60 dark:bg-[#121214] text-[#F21B2D] text-xs font-semibold rounded-xl px-2.5 py-1.5 border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D]"
              aria-label="Sort drinks"
            >
              <option value="krent">KrentProcent (Best Value)</option>
              <option value="price">Lowest Price</option>
              <option value="abv">Highest ABV %</option>
              <option value="alcohol">Most Total Alcohol</option>
            </select>
          </div>
        </div>
      </div>

      {/* Drink Cards List */}
      <div className="space-y-3">
        {ranked.length === 0 ? (
          <div className="bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl p-6 text-center space-y-2 shadow-sm">
            <p className="text-[#18181B] dark:text-zinc-200 font-semibold text-sm">
              No drinks recorded yet for <span className="text-[#F21B2D]">{activeBar}</span>.
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Add a drink using the form above or copy a known beer from another bar!
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl p-6 text-center text-zinc-500 dark:text-zinc-400 text-sm shadow-sm">
            No drinks matching this filter at {activeBar === 'all' ? 'any bar' : activeBar}.
          </div>
        ) : (
          filtered.map((drink) => {
            const sig = `${normalizeDrinkKey(drink.name)}::${Math.round(drink.volumeMl)}`;
            const totalBarsWithDrink = crossBarPresenceMap.get(sig)?.size || 1;
            const otherBarsCount = Math.max(0, totalBarsWithDrink - 1);

            return (
              <DrinkCard
                key={drink.id}
                drink={drink}
                currency={currency}
                onDelete={onDeleteDrink}
                onUpdate={onUpdateDrink}
                onSelectBar={onSelectBar}
                availableBars={availableBars}
                bestScore={bestOverall?.pureAlcoholPerCurrency || 0}
                otherBarsCount={otherBarsCount}
              />
            );
          })
        )}
      </div>
    </div>
  );
};
