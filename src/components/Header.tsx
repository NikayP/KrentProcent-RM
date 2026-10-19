import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Beer,
  Camera,
  Swords,
  Users,
  RefreshCw,
  Store,
  Trash2,
  Plus,
  Pencil,
  Check,
  X,
  ChevronDown,
  Search,
  Globe,
  MapPin,
} from 'lucide-react';
import { DrinkItem, filterDrinksByBar, normalizeBarKey, DEFAULT_BAR_NAME } from '../utils/calculator';

interface HeaderProps {
  activeTab: 'calculator' | 'scanner' | 'duel' | 'group' | 'bars';
  setActiveTab: (tab: 'calculator' | 'scanner' | 'duel' | 'group' | 'bars') => void;
  currency: string;
  setCurrency: (c: string) => void;
  drinkCount: number;
  drinks: DrinkItem[];
  onReset: () => void;
  activeBar: string;
  availableBars: string[];
  onSelectBar: (bar: string) => void;
  onAddBar?: (barName: string) => void;
  onRenameBar?: (oldName: string, newName: string) => void;
  onDeleteBar?: (bar: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  currency,
  setCurrency,
  drinkCount,
  drinks,
  onReset,
  activeBar,
  availableBars,
  onSelectBar,
  onAddBar,
  onRenameBar,
  onDeleteBar,
}) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [barSearchQuery, setBarSearchQuery] = useState('');
  const [isAddingBar, setIsAddingBar] = useState(false);
  const [newBarInput, setNewBarInput] = useState('');
  const [isRenamingBar, setIsRenamingBar] = useState(false);
  const [renameInput, setRenameInput] = useState('');

  const pickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close picker on outside click or Escape
  useEffect(() => {
    if (!isPickerOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsPickerOpen(false);
        setBarSearchQuery('');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPickerOpen(false);
        setBarSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPickerOpen]);

  // Focus search input when picker opens
  useEffect(() => {
    if (isPickerOpen && availableBars.length > 3) {
      setTimeout(() => searchInputRef.current?.focus(), 40);
    }
  }, [isPickerOpen, availableBars.length]);

  // Precompute drink count per bar in a single pass
  const barCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const bar of availableBars) {
      counts.set(bar, filterDrinksByBar(drinks, bar).length);
    }
    return counts;
  }, [drinks, availableBars]);

  const activeBarDrinkCount =
    activeBar === 'all' ? drinkCount : (barCounts.get(activeBar) ?? filterDrinksByBar(drinks, activeBar).length);

  // Filtered & sorted bars for the picker
  const filteredBars = useMemo(() => {
    const q = barSearchQuery.trim().toLowerCase();
    const list = q
      ? availableBars.filter((b) => b.toLowerCase().includes(q) || normalizeBarKey(b).includes(normalizeBarKey(q)))
      : [...availableBars];

    // Sort: active bar first, then by drink count descending, then alphabetically
    return list.sort((a, b) => {
      if (a === activeBar) return -1;
      if (b === activeBar) return 1;
      const countDiff = (barCounts.get(b) || 0) - (barCounts.get(a) || 0);
      if (countDiff !== 0) return countDiff;
      return a.localeCompare(b);
    });
  }, [availableBars, barSearchQuery, activeBar, barCounts]);

  // Check if search query doesn't match any existing bar exactly -> allow 1-click creation
  const canCreateFromSearch = useMemo(() => {
    const trimmed = barSearchQuery.trim();
    if (!trimmed) return false;
    const key = normalizeBarKey(trimmed);
    return !availableBars.some((b) => normalizeBarKey(b) === key);
  }, [barSearchQuery, availableBars]);

  // Quick-access bars on larger screens: up to 3 most-populated bars (excluding activeBar if shown)
  const quickSwitchBars = useMemo(() => {
    return [...availableBars]
      .sort((a, b) => (barCounts.get(b) || 0) - (barCounts.get(a) || 0) || a.localeCompare(b))
      .slice(0, 3);
  }, [availableBars, barCounts]);

  const handleCreateBarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newBarInput.trim();
    if (!trimmed) return;
    if (onAddBar) {
      onAddBar(trimmed);
    } else {
      onSelectBar(trimmed);
    }
    setNewBarInput('');
    setIsAddingBar(false);
    setIsPickerOpen(false);
  };

  const handleCreateFromSearch = () => {
    const trimmed = barSearchQuery.trim();
    if (!trimmed) return;
    if (onAddBar) {
      onAddBar(trimmed);
    } else {
      onSelectBar(trimmed);
    }
    setBarSearchQuery('');
    setIsPickerOpen(false);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = renameInput.trim();
    if (!trimmed || activeBar === 'all') return;
    if (onRenameBar && trimmed !== activeBar) {
      onRenameBar(activeBar, trimmed);
    }
    setIsRenamingBar(false);
  };

  const startRenaming = () => {
    if (activeBar === 'all') return;
    setRenameInput(activeBar);
    setIsRenamingBar(true);
    setIsAddingBar(false);
    setIsPickerOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-stone-900/95 backdrop-blur-md border-b border-amber-900/40 text-stone-100 shadow-xl">
      <div className="max-w-6xl mx-auto px-4 py-2.5 sm:py-3 sm:px-6 space-y-2">
        {/* Top Row: Brand & Currency/Reset */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 text-stone-950 font-black text-xl shrink-0">
              <Beer className="w-5 h-5 sm:w-6 sm:h-6 text-stone-950" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white flex items-center gap-1.5 whitespace-nowrap">
                  KrentProcent{' '}
                  <span className="text-amber-400 text-[11px] sm:text-xs px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/30 shrink-0">
                    RM
                  </span>
                </h1>
                <span className="hidden sm:inline-block whitespace-nowrap text-[11px] font-medium bg-amber-500/10 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/20 shrink-0">
                  Bar Value Meter
                </span>
              </div>
              <p className="hidden xs:block text-[11px] sm:text-xs text-stone-400 font-medium truncate">
                Most pure alcohol per coin at the bar &bull; Compare by venue &amp; menu
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="bg-stone-800 hover:bg-stone-750 text-amber-300 font-bold text-xs rounded-lg px-2.5 py-1.5 sm:py-2 border border-stone-700 focus:outline-none focus:border-amber-500 transition-colors"
              aria-label="Currency"
            >
              <option value="€">€ EUR</option>
              <option value="$">$ USD</option>
              <option value="£">£ GBP</option>
              <option value="kr">kr SEK/NOK</option>
              <option value="CHF">CHF</option>
            </select>

            {(drinkCount > 0 || availableBars.length > 0) && (
              <button
                onClick={onReset}
                title="Reset all drinks and bars"
                className="p-1.5 sm:p-2 text-stone-400 hover:text-rose-400 hover:bg-stone-800 rounded-lg transition-colors border border-stone-800"
                aria-label="Clear all drinks"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs Row */}
        <div>
          <nav className="flex items-center gap-1 bg-stone-950/80 p-1 rounded-xl border border-stone-800 text-xs font-semibold overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('calculator')}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'calculator'
                  ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
              }`}
            >
              <Beer className="w-4 h-4 shrink-0" />
              <span>Drinks ({drinkCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('bars')}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'bars'
                  ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
              }`}
            >
              <Store className="w-4 h-4 shrink-0" />
              <span>Compare Bars ({availableBars.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('scanner')}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'scanner'
                  ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
              }`}
            >
              <Camera className="w-4 h-4 shrink-0" />
              <span className="flex items-center gap-1">
                Scan Menu{' '}
                <span
                  className={`text-[10px] px-1 rounded font-bold ${
                    activeTab === 'scanner'
                      ? 'bg-stone-950/20 text-stone-950'
                      : 'bg-amber-400/20 text-amber-200'
                  }`}
                >
                  AI
                </span>
              </span>
            </button>

            <button
              onClick={() => setActiveTab('duel')}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'duel'
                  ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
              }`}
            >
              <Swords className="w-4 h-4 shrink-0" />
              <span>1v1 Duel</span>
            </button>

            <button
              onClick={() => setActiveTab('group')}
              aria-label="Pitcher Saver Tab"
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'group'
                  ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>Pitcher Saver</span>
            </button>
          </nav>
        </div>
      </div>

      {/* COMPACT VENUE SCOPE SUB-BAR: Always 1 single row, scalable to 50+ bars */}
      <div className="bg-stone-950 border-t border-stone-850 px-4 py-1.5 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 text-xs">
          {/* Left: Sitting At Selector + Quick Desktop Pills */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-stone-400 font-semibold flex items-center gap-1 shrink-0">
              <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="hidden xs:inline">Sitting At:</span>
            </span>

            {/* Searchable Bar Picker Popover Container */}
            <div ref={pickerRef} className="relative min-w-0 max-w-[240px] sm:max-w-[300px]">
              <button
                type="button"
                onClick={() => {
                  setIsPickerOpen((prev) => !prev);
                  setIsRenamingBar(false);
                  setIsAddingBar(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg font-bold transition-all border text-left ${
                  activeBar === 'all'
                    ? 'bg-stone-900 hover:bg-stone-850 text-white border-stone-750'
                    : 'bg-amber-400 hover:bg-amber-300 text-stone-950 border-amber-300 shadow-sm'
                }`}
                aria-expanded={isPickerOpen}
                aria-haspopup="listbox"
              >
                <span className="flex items-center gap-1.5 min-w-0 truncate">
                  {activeBar === 'all' ? (
                    <Globe className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  ) : (
                    <Store className="w-3.5 h-3.5 text-stone-950 shrink-0" />
                  )}
                  <span className="truncate">
                    {activeBar === 'all' ? 'All Bars' : activeBar}
                  </span>
                </span>

                <span className="flex items-center gap-1 shrink-0">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 leading-none rounded-full font-mono ${
                      activeBar === 'all'
                        ? 'bg-stone-800 text-amber-300'
                        : 'bg-stone-950/20 text-stone-950 font-black'
                    }`}
                  >
                    {activeBarDrinkCount}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-150 ${
                      isPickerOpen ? 'rotate-180' : ''
                    } ${activeBar === 'all' ? 'text-stone-400' : 'text-stone-950'}`}
                  />
                </span>
              </button>

              {/* Dropdown Menu */}
              {isPickerOpen && (
                <div className="absolute left-0 mt-1.5 w-72 sm:w-80 bg-stone-900 border border-stone-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  {/* Search / Quick Add Input */}
                  <div className="p-2 border-b border-stone-800 bg-stone-950/60">
                    <div className="relative flex items-center">
                      <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 pointer-events-none" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={barSearchQuery}
                        onChange={(e) => setBarSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (filteredBars.length === 1) {
                              onSelectBar(filteredBars[0]);
                              setIsPickerOpen(false);
                              setBarSearchQuery('');
                            } else if (canCreateFromSearch) {
                              handleCreateFromSearch();
                            }
                          }
                        }}
                        placeholder={`Search ${availableBars.length} bars or type new...`}
                        className="w-full bg-stone-900 text-white text-xs rounded-lg pl-8 pr-7 py-1.5 border border-stone-750 focus:outline-none focus:border-amber-400 placeholder:text-stone-500"
                      />
                      {barSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setBarSearchQuery('')}
                          className="absolute right-2 text-stone-400 hover:text-white"
                          aria-label="Clear search"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Bar List */}
                  <div className="max-h-60 overflow-y-auto divide-y divide-stone-800/50">
                    {/* All Bars Global Option */}
                    {!barSearchQuery.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectBar('all');
                          setIsPickerOpen(false);
                          setBarSearchQuery('');
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${
                          activeBar === 'all'
                            ? 'bg-amber-500/15 text-amber-300 font-bold'
                            : 'text-stone-200 hover:bg-stone-800'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Globe className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>All Bars (Compare Global)</span>
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-stone-800 text-stone-300">
                          {drinkCount} drinks
                        </span>
                      </button>
                    )}

                    {/* Filtered Venue List */}
                    {filteredBars.map((bar) => {
                      const count = barCounts.get(bar) || 0;
                      const isSelected = activeBar === bar;
                      return (
                        <button
                          key={bar}
                          type="button"
                          onClick={() => {
                            onSelectBar(bar);
                            setIsPickerOpen(false);
                            setBarSearchQuery('');
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors text-left ${
                            isSelected
                              ? 'bg-amber-500/20 text-amber-300 font-bold'
                              : 'text-stone-200 hover:bg-stone-800'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0 truncate">
                            <Store
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isSelected ? 'text-amber-400' : 'text-stone-400'
                              }`}
                            />
                            <span className="truncate">{bar}</span>
                          </span>
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full shrink-0 ml-2 ${
                              isSelected
                                ? 'bg-amber-400 text-stone-950 font-black'
                                : 'bg-stone-800 text-stone-400'
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}

                    {filteredBars.length === 0 && !canCreateFromSearch && (
                      <div className="px-3 py-4 text-center text-stone-500 text-xs">
                        No bars found.
                      </div>
                    )}
                  </div>

                  {/* Create New Bar from Search or Footer Button */}
                  <div className="p-2 border-t border-stone-800 bg-stone-950/80">
                    {canCreateFromSearch ? (
                      <button
                        type="button"
                        onClick={handleCreateFromSearch}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span className="truncate">Create &amp; Sit at "{barSearchQuery.trim()}"</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsPickerOpen(false);
                          setIsAddingBar(true);
                          setIsRenamingBar(false);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-750 text-amber-300 font-semibold text-xs border border-stone-700 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add New Bar Venue</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Toggle to All Bars on Mobile/Desktop when isolated to a bar */}
            {activeBar !== 'all' && !isAddingBar && !isRenamingBar && (
              <button
                type="button"
                onClick={() => onSelectBar('all')}
                title="Switch back to viewing all bars"
                className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-800 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1"
              >
                <Globe className="w-3 h-3 text-amber-400" />
                <span className="hidden sm:inline">All Bars</span>
              </button>
            )}

            {/* Top 3 Quick-Switch Chips ONLY on large desktop screens when not editing */}
            {!isAddingBar && !isRenamingBar && (
              <div className="hidden lg:flex items-center gap-1 min-w-0 overflow-hidden">
                {quickSwitchBars
                  .filter((b) => b !== activeBar)
                  .slice(0, 3)
                  .map((bar) => (
                    <button
                      key={bar}
                      type="button"
                      onClick={() => onSelectBar(bar)}
                      className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-stone-900/70 hover:bg-stone-800 text-stone-400 hover:text-stone-200 border border-stone-800/80 transition-colors whitespace-nowrap truncate max-w-[140px]"
                      title={`Quick switch to ${bar} (${barCounts.get(bar) || 0} drinks)`}
                    >
                      {bar} <span className="text-[10px] opacity-60">({barCounts.get(bar) || 0})</span>
                    </button>
                  ))}
              </div>
            )}

            {/* Inline New Bar Form */}
            {isAddingBar && (
              <form onSubmit={handleCreateBarSubmit} className="flex items-center gap-1 shrink-0">
                <input
                  type="text"
                  value={newBarInput}
                  onChange={(e) => setNewBarInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsAddingBar(false);
                      setNewBarInput('');
                    }
                  }}
                  placeholder="New bar name..."
                  autoFocus
                  className="bg-stone-900 text-white text-xs rounded-lg px-2.5 py-1 border border-amber-400 focus:outline-none w-32 sm:w-40"
                />
                <button
                  type="submit"
                  className="p-1 rounded-lg bg-amber-500 text-stone-950 hover:bg-amber-400"
                  title="Save new bar"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingBar(false);
                    setNewBarInput('');
                  }}
                  className="p-1 rounded-lg bg-stone-800 text-stone-400 hover:text-white"
                  title="Cancel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </form>
            )}
          </div>

          {/* Right: Contextual Actions for Active Bar or + New Bar */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isRenamingBar ? (
              <form onSubmit={handleRenameSubmit} className="flex items-center gap-1">
                <input
                  type="text"
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setIsRenamingBar(false);
                  }}
                  autoFocus
                  className="bg-stone-900 text-white text-xs rounded-md px-2 py-0.5 border border-amber-400 focus:outline-none w-28 sm:w-36"
                />
                <button
                  type="submit"
                  className="p-1 rounded bg-emerald-500 text-stone-950 hover:bg-emerald-400"
                  title="Confirm rename"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsRenamingBar(false)}
                  className="p-1 rounded bg-stone-800 text-stone-400 hover:text-white"
                  title="Cancel rename"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              <>
                {onAddBar && !isAddingBar && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingBar(true);
                      setIsRenamingBar(false);
                      setIsPickerOpen(false);
                    }}
                    title="Add a new bar venue"
                    className="p-1 px-2 rounded-lg font-semibold whitespace-nowrap border border-dashed border-stone-700 hover:border-amber-400/60 text-stone-300 hover:text-amber-300 bg-stone-900/60 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden sm:inline text-[11px]">New Bar</span>
                  </button>
                )}

                {activeBar !== 'all' && !isAddingBar && (
                  <>
                    {onRenameBar && (
                      <button
                        type="button"
                        onClick={startRenaming}
                        title={`Rename ${activeBar}`}
                        className="p-1 px-1.5 text-stone-300 hover:text-amber-300 bg-stone-900 hover:bg-stone-800 border border-stone-800 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        aria-label={`Rename bar ${activeBar}`}
                      >
                        <Pencil className="w-3.5 h-3.5 text-amber-400" />
                        <span className="hidden md:inline text-[11px] font-semibold">Rename</span>
                      </button>
                    )}

                    {onDeleteBar && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onDeleteBar(activeBar);
                        }}
                        title={`Delete ${activeBar} and all of its drinks`}
                        className="p-1 px-1.5 text-stone-400 hover:text-rose-400 bg-stone-900 hover:bg-rose-950/60 border border-stone-800 hover:border-rose-800/80 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        aria-label={`Delete bar ${activeBar}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span className="hidden md:inline text-[11px] font-semibold text-rose-400">
                          Delete
                        </span>
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

