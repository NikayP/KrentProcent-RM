import React, { useEffect, useState } from 'react';
import {
  Compass,
  Search,
  MapPin,
  User,
  Download,
  ChevronDown,
  ChevronUp,
  Loader2,
  WifiOff,
  Trophy,
  X,
  RefreshCw,
} from 'lucide-react';
import {
  type CalculatedDrink,
  type DrinkItem,
  areBarNamesEquivalent,
  formatCurrency,
  rankDrinks,
} from '../../utils/calculator';
import {
  type PublicBarSummary,
  getPublicBarDrinks,
  searchPublicBars,
} from '../../utils/publicBars';
import {
  formatRelativeUpdatedAt,
  normalizeSearchQuery,
} from '../../utils/publicBarsCore';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { ConfirmModal } from '../ConfirmModal';

interface DiscoverPanelProps {
  currency: string;
  existingBars: string[];
  initialQuery?: string;
  onQueryChange?: (q: string) => void;
  onAdoptBar: (drinks: DrinkItem[], sourceUsername: string, barName: string) => void;
}

export const DiscoverPanel: React.FC<DiscoverPanelProps> = ({
  currency,
  existingBars,
  initialQuery = '',
  onQueryChange,
  onAdoptBar,
}) => {
  const isOnline = useOnlineStatus();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<PublicBarSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drinksCache, setDrinksCache] = useState<
    Record<string, { drinks: DrinkItem[]; topDrinks: CalculatedDrink[] }>
  >({});
  const [loadingDrinksId, setLoadingDrinksId] = useState<string | null>(null);
  const [adoptingId, setAdoptingId] = useState<string | null>(null);
  const [drinksErrorId, setDrinksErrorId] = useState<string | null>(null);
  const [pendingAdopt, setPendingAdopt] = useState<{
    summary: PublicBarSummary;
    drinks: DrinkItem[];
  } | null>(null);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!isOnline) {
      setIsLoading(false);
      setErrorMsg(null);
      return;
    }

    let cancelled = false;
    const delay = query.trim() === '' ? 0 : 300;
    setIsLoading(true);
    setErrorMsg(null);

    const timer = setTimeout(() => {
      void searchPublicBars(query)
        .then((rows) => {
          if (cancelled) return;
          setResults(rows);
        })
        .catch((err) => {
          if (cancelled) return;
          setErrorMsg(
            err instanceof Error ? err.message : 'Could not load public bars.'
          );
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, isOnline, reloadNonce]);

  const handleQueryInput = (next: string) => {
    const clean = next.slice(0, 60);
    setQuery(clean);
    onQueryChange?.(normalizeSearchQuery(clean));
  };

  const loadDrinksForBar = async (summary: PublicBarSummary): Promise<DrinkItem[] | null> => {
    const cached = drinksCache[summary.id];
    if (cached) return cached.drinks;

    setDrinksErrorId(null);
    setLoadingDrinksId(summary.id);
    try {
      const fetched = await getPublicBarDrinks(summary.id, summary.barName);
      const topDrinks = rankDrinks(fetched).slice(0, 3);
      setDrinksCache((prev) => ({ ...prev, [summary.id]: { drinks: fetched, topDrinks } }));
      return fetched;
    } catch {
      setDrinksErrorId(summary.id);
      return null;
    } finally {
      setLoadingDrinksId((prev) => (prev === summary.id ? null : prev));
    }
  };

  const handleToggleExpand = (summary: PublicBarSummary) => {
    if (expandedId === summary.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(summary.id);
    if (!drinksCache[summary.id] && isOnline) {
      void loadDrinksForBar(summary);
    }
  };

  const handleAdoptClick = async (summary: PublicBarSummary) => {
    if (!isOnline) return;
    setAdoptingId(summary.id);
    const barDrinks = await loadDrinksForBar(summary);
    setAdoptingId(null);

    if (!barDrinks || barDrinks.length === 0) {
      setExpandedId(summary.id);
      return;
    }

    const alreadyExists = existingBars.some((b) =>
      areBarNamesEquivalent(b, summary.barName)
    );

    if (alreadyExists) {
      setPendingAdopt({ summary, drinks: barDrinks });
      return;
    }

    onAdoptBar(barDrinks, summary.username, summary.barName);
  };

  return (
    <div className="space-y-4">
      {/* Search Header Card */}
      <div className="bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl p-5 shadow-sm space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-[#FF8A8E]/20 text-[#F21B2D]">
                <Compass className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-extrabold tracking-[-0.03em] text-[#18181B] dark:text-[#FFFFFF]">
                Discover Community Bars
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Browse menus shared by other users and add them to your own board in one tap.
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => handleQueryInput(e.target.value)}
            placeholder="Search @username, bar or city"
            aria-label="Search public bars"
            className="w-full bg-[#FFF2F3]/50 dark:bg-[#121214] text-[#18181B] dark:text-white text-sm rounded-xl pl-10 pr-9 py-2.5 border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D]"
          />
          {query && (
            <button
              type="button"
              onClick={() => handleQueryInput('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-zinc-400 hover:text-[#18181B] dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
          <span>
            {query.trim()
              ? `Results for "${query.trim()}"`
              : 'Recently shared'}
          </span>
          {isOnline && (
            <button
              type="button"
              onClick={() => setReloadNonce((n) => n + 1)}
              disabled={isLoading}
              className="inline-flex items-center gap-1 hover:text-[#F21B2D] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* Offline state */}
      {!isOnline && (
        <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-5 flex items-center gap-3 text-xs text-amber-800 dark:text-amber-300">
          <WifiOff className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>Discover needs an internet connection.</span>
        </div>
      )}

      {/* Error state */}
      {isOnline && errorMsg && (
        <div className="rounded-2xl border border-[#F21B2D]/40 bg-[#F21B2D]/10 p-4 text-xs text-[#D91424] dark:text-[#FF8A8E] flex items-center justify-between gap-3">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            className="px-3 py-1.5 rounded-xl bg-[#F21B2D] text-white font-bold shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {isOnline && isLoading && results.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl p-5 space-y-3 animate-pulse"
            >
              <div className="h-5 w-44 rounded-lg bg-[#FFF2F3] dark:bg-[#27272A]" />
              <div className="h-3.5 w-32 rounded-lg bg-[#FFF2F3] dark:bg-[#27272A]" />
              <div className="h-9 w-full rounded-xl bg-[#FFF2F3]/70 dark:bg-[#121214]" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {isOnline && !isLoading && !errorMsg && results.length === 0 && (
        <div className="bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl p-8 text-center space-y-2 shadow-sm">
          <Compass className="w-10 h-10 text-[#F21B2D]/80 mx-auto" />
          <h3 className="text-base font-bold text-[#18181B] dark:text-white">
            {query.trim() ? 'No matching public bars' : 'No public bars shared yet'}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
            {query.trim()
              ? 'Try searching for another @username, bar name, or city.'
              : 'Be the first! Make one of your bars Public in My Bars.'}
          </p>
        </div>
      )}

      {/* Results Grid */}
      {isOnline && results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {results.map((item) => {
            const isExpanded = expandedId === item.id;
            const cachedEntry = drinksCache[item.id];
            const cachedDrinks = cachedEntry?.drinks;
            const isLoadingDrinks = loadingDrinksId === item.id;
            const isAdopting = adoptingId === item.id;
            const hasLocalBar = existingBars.some((b) =>
              areBarNamesEquivalent(b, item.barName)
            );
            const topDrinks = cachedEntry?.topDrinks ?? [];
            const relativeTime = formatRelativeUpdatedAt(item.updatedAt);

            return (
              <div
                key={item.id}
                className="bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-base font-extrabold tracking-[-0.02em] text-[#18181B] dark:text-white truncate">
                        {item.barName}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        <button
                          type="button"
                          onClick={() => handleQueryInput(`@${item.username}`)}
                          className="inline-flex items-center gap-1 font-semibold text-[#F21B2D] hover:underline"
                          title={`See all bars by @${item.username}`}
                        >
                          <User className="w-3 h-3" />
                          <span>@{item.username}</span>
                        </button>
                        {item.city && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            <span>{item.city}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="text-[11px] font-bold tabular-nums bg-[#FFF2F3] dark:bg-[#121214] border border-[#E4E4E7] dark:border-[#27272A] px-2.5 py-0.5 rounded-full text-zinc-600 dark:text-zinc-300 shrink-0">
                      {item.drinkCount} {item.drinkCount === 1 ? 'drink' : 'drinks'}
                    </span>
                  </div>

                  {relativeTime && (
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                      Updated {relativeTime}
                    </p>
                  )}

                  {/* Expanded Menu Preview */}
                  {isExpanded && (
                    <div className="pt-2 space-y-2">
                      {isLoadingDrinks && (
                        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 py-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#F21B2D]" />
                          <span>Loading menu…</span>
                        </div>
                      )}

                      {drinksErrorId === item.id && (
                        <div className="text-xs text-[#D91424] dark:text-[#FF8A8E]">
                          Could not load drinks for this bar.
                        </div>
                      )}

                      {!isLoadingDrinks && cachedDrinks && topDrinks.length > 0 && (
                        <div className="rounded-xl bg-[#FFF2F3]/60 dark:bg-[#121214] border border-[#E4E4E7] dark:border-[#27272A] p-3 space-y-1.5">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-[#F21B2D] flex items-center gap-1">
                            <Trophy className="w-3 h-3" />
                            <span>Top Value Deals</span>
                          </div>
                          {topDrinks.map((d, idx) => (
                            <div
                              key={d.id}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="min-w-0 truncate text-[#18181B] dark:text-zinc-200">
                                <span className="font-bold text-zinc-400 mr-1.5">
                                  #{idx + 1}
                                </span>
                                <span className="font-semibold">{d.name}</span>{' '}
                                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                  ({d.volumeMl}ml &bull; {d.abv}%)
                                </span>
                              </div>
                              <div className="shrink-0 tabular-nums text-right">
                                <span className="font-bold text-[#18181B] dark:text-white mr-2">
                                  {formatCurrency(d.price, currency)}
                                </span>
                                <span className="font-bold text-[#F21B2D]">
                                  {d.pureAlcoholPerCurrency} ml/{currency}
                                </span>
                              </div>
                            </div>
                          ))}
                          {cachedDrinks.length > 3 && (
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 pt-1">
                              +{cachedDrinks.length - 3} more drink
                              {cachedDrinks.length - 3 === 1 ? '' : 's'} on this menu
                            </p>
                          )}
                        </div>
                      )}

                      {!isLoadingDrinks && cachedDrinks && cachedDrinks.length === 0 && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          This bar has no drinks logged yet.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleExpand(item)}
                    className="px-3 py-2 rounded-xl bg-[#FFF2F3] dark:bg-[#121214] hover:bg-zinc-100 dark:hover:bg-[#27272A] text-[#18181B] dark:text-zinc-200 border border-[#E4E4E7] dark:border-[#27272A] text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <span>{isExpanded ? 'Hide' : 'Preview'}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isAdopting || item.drinkCount === 0}
                    onClick={() => void handleAdoptClick(item)}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#F21B2D] hover:bg-[#D91424] disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    {isAdopting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>{hasLocalBar ? 'Update My Bar' : 'Add to My Bars'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(pendingAdopt)}
        title={`Update "${pendingAdopt?.summary.barName}"?`}
        message={
          pendingAdopt
            ? `You already have "${pendingAdopt.summary.barName}". Update its prices with @${pendingAdopt.summary.username}'s menu?`
            : ''
        }
        confirmLabel="Update Bar"
        cancelLabel="Cancel"
        variant="primary"
        onConfirm={() => {
          if (pendingAdopt) {
            onAdoptBar(
              pendingAdopt.drinks,
              pendingAdopt.summary.username,
              pendingAdopt.summary.barName
            );
          }
          setPendingAdopt(null);
        }}
        onCancel={() => setPendingAdopt(null)}
      />
    </div>
  );
};
