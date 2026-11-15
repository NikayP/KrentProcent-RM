import React, { useState, useMemo, useEffect } from 'react';
import {
  DrinkItem,
  rankDrinks,
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
  Share2,
  Check,
  Beer,
  Store,
  Search,
} from 'lucide-react';
import { CategoryIcon, DRINK_CATEGORY_META } from './CategoryIcon';
import {
  preloadShareCardAssets,
  shareTopThreeImage,
  type ShareSortOption,
} from '../utils/shareCard';

interface LeaderboardProps {
  drinks: DrinkItem[];
  currency: string;
  onDeleteDrink: (id: string) => void;
  onUpdateDrink?: (drink: DrinkItem) => void;
  onLoadPresets: () => void;
  activeBar: string;
  onSelectBar: (bar: string) => void;
  availableBars: string[];
}

type SortOption = ShareSortOption;

export const Leaderboard: React.FC<LeaderboardProps> = ({
  drinks,
  currency,
  onDeleteDrink,
  onUpdateDrink,
  onLoadPresets,
  activeBar,
  onSelectBar,
  availableBars,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('krent');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [shareStatus, setShareStatus] = useState<'idle' | 'generating' | 'shared' | 'copied' | 'downloaded'>('idle');

  useEffect(() => {
    preloadShareCardAssets();
  }, []);

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
  const topThree = useMemo(() => filtered.slice(0, 3), [filtered]);

  const handleShareTopThree = async () => {
    if (topThree.length === 0 || shareStatus === 'generating') return;
    setShareStatus('generating');
    try {
      const outcome = await shareTopThreeImage({
        drinks: topThree,
        activeBar,
        selectedCategory,
        sortBy,
        searchQuery,
        currency,
      });
      if (outcome === 'shared' || outcome === 'copied' || outcome === 'downloaded') {
        setShareStatus(outcome);
        setTimeout(() => setShareStatus('idle'), 2000);
      } else {
        setShareStatus('idle');
      }
    } catch (err) {
      console.error('Failed to generate Top 3 share image:', err);
      setShareStatus('idle');
    }
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
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#FF8A8E]/20 text-[#F21B2D] flex items-center justify-center shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
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

        {/* Subtle Top 3 image share */}
        {topThree.length > 0 && (
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleShareTopThree}
              disabled={shareStatus === 'generating'}
              title={`Share current Top ${topThree.length} as image`}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#FFF2F3] dark:bg-[#121214] hover:bg-[#FF8A8E]/20 text-[#18181B] dark:text-zinc-200 border border-[#E4E4E7] dark:border-[#27272A] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              {shareStatus === 'shared' || shareStatus === 'copied' || shareStatus === 'downloaded' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {shareStatus === 'shared'
                      ? 'Shared!'
                      : shareStatus === 'copied'
                        ? 'Copied PNG!'
                        : 'Saved PNG!'}
                  </span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-[#F21B2D] shrink-0" />
                  <span>{topThree.length === 1 ? 'Share #1' : `Share Top ${topThree.length}`}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

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
