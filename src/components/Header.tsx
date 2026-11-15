import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Beer,
  Camera,
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
  Sun,
  Moon,
  User,
  UserCheck,
  Download,
  WifiOff,
} from 'lucide-react';
import { DrinkItem, filterDrinksByBar, normalizeBarKey } from '../utils/calculator';
import { BrandLogo } from './BrandLogo';

interface HeaderProps {
  activeTab: 'calculator' | 'scanner' | 'bars';
  setActiveTab: (tab: 'calculator' | 'scanner' | 'bars') => void;
  drinkCount: number;
  drinks: DrinkItem[];
  onReset: () => void;
  activeBar: string;
  availableBars: string[];
  onSelectBar: (bar: string) => void;
  onAddBar?: (barName: string) => void;
  onRenameBar?: (oldName: string, newName: string) => void;
  onDeleteBar?: (bar: string) => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  accountName?: string | null;
  syncStatus?: 'idle' | 'saving' | 'saved' | 'offline';
  onOpenAccount?: () => void;
  isAccountActive?: boolean;
  canInstall?: boolean;
  onInstallApp?: () => void;
  isOnline?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  drinkCount,
  drinks,
  onReset,
  activeBar,
  availableBars,
  onSelectBar,
  onAddBar,
  onRenameBar,
  onDeleteBar,
  theme = 'light',
  onToggleTheme,
  accountName,
  syncStatus,
  onOpenAccount,
  isAccountActive = false,
  canInstall = false,
  onInstallApp,
  isOnline = true,
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
    <header className="sticky top-0 z-40 pt-[env(safe-area-inset-top)] bg-[#FFFFFF]/95 dark:bg-[#18181B]/95 backdrop-blur-md border-b border-[#E4E4E7] dark:border-[#27272A] text-[#18181B] dark:text-[#FFFFFF] shadow-sm transition-colors duration-200 select-none">
      <div className="max-w-6xl mx-auto px-4 py-2.5 sm:py-3 sm:px-6 space-y-2.5">
        {/* Top Row: Brand & Theme/Reset Controls */}
        <div className="flex items-center justify-between gap-3">
          <BrandLogo />

          {/* Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {!isOnline && (
              <span
                title="Offline mode — local data and text menu parsing work offline"
                className="px-2 py-1 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300 text-[11px] font-bold flex items-center gap-1"
              >
                <WifiOff className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Offline</span>
              </span>
            )}

            {canInstall && onInstallApp && (
              <button
                type="button"
                onClick={onInstallApp}
                title="Install KrentProcent as an app"
                className="px-2.5 py-1.5 sm:py-2 rounded-xl bg-[#F21B2D] hover:bg-[#D91424] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                aria-label="Install app"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Install</span>
              </button>
            )}

            {onOpenAccount && (
              <button
                id="tour-account-btn"
                type="button"
                onClick={onOpenAccount}
                title={accountName ? `Manage account (${accountName})` : 'Log in or create account in Bar Hub'}
                className={`px-2.5 py-1.5 sm:py-2 rounded-xl transition-colors border text-xs font-semibold flex items-center gap-1.5 max-w-[140px] ${
                  isAccountActive
                    ? 'bg-[#F21B2D] text-white border-[#F21B2D] shadow-sm'
                    : accountName
                      ? 'bg-[#FFF2F3] dark:bg-[#121214] text-[#18181B] dark:text-white border-[#F21B2D]/40 hover:bg-[#FF8A8E]/20 dark:hover:bg-[#27272A]'
                      : 'bg-[#FFF2F3] dark:bg-[#121214] text-zinc-600 dark:text-zinc-300 hover:text-[#18181B] dark:hover:text-white border-[#E4E4E7] dark:border-[#27272A] hover:bg-[#FF8A8E]/20 dark:hover:bg-[#27272A]'
                }`}
                aria-label={accountName ? `Account (${accountName})` : 'Log in or create account'}
                aria-current={isAccountActive ? 'page' : undefined}
              >
                {accountName ? (
                  <>
                    <UserCheck
                      className={`w-4 h-4 shrink-0 ${
                        isAccountActive ? 'text-white' : 'text-[#F21B2D]'
                      }`}
                    />
                    <span className="truncate hidden sm:inline">{accountName}</span>
                    {syncStatus === 'offline' && (
                      <span
                        className="w-2 h-2 rounded-full bg-amber-400 shrink-0"
                        title="Offline — waiting to sync"
                      />
                    )}
                  </>
                ) : (
                  <>
                    <User className="w-4 h-4 shrink-0" />
                    <span className="hidden sm:inline">Account</span>
                  </>
                )}
              </button>
            )}

            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                className="p-1.5 sm:p-2 text-zinc-600 dark:text-zinc-300 hover:text-[#18181B] dark:hover:text-white bg-[#FFF2F3] dark:bg-[#121214] hover:bg-[#FF8A8E]/20 dark:hover:bg-[#27272A] rounded-xl transition-colors border border-[#E4E4E7] dark:border-[#27272A]"
                aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-[#FF8A8E]" />
                ) : (
                  <Moon className="w-4 h-4 text-[#18181B]" />
                )}
              </button>
            )}

            {(drinkCount > 0 || availableBars.length > 0) && (
              <button
                onClick={onReset}
                title="Reset all drinks and bars"
                className="p-1.5 sm:p-2 text-zinc-500 dark:text-zinc-400 hover:text-[#F21B2D] dark:hover:text-[#FF8A8E] bg-[#FFF2F3] dark:bg-[#121214] hover:bg-[#FF8A8E]/20 dark:hover:bg-[#27272A] rounded-xl transition-colors border border-[#E4E4E7] dark:border-[#27272A]"
                aria-label="Clear all drinks"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs Row (Desktop & Tablet — Mobile uses BottomTabBar) */}
        <div className="hidden sm:block">
          <nav className="grid grid-cols-3 gap-1.5 bg-[#FFF2F3] dark:bg-[#121214] p-1 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] text-xs font-semibold">
            {/* 1. Left: Drinks Calculator */}
            <button
              onClick={() => setActiveTab('calculator')}
              className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl transition-all whitespace-nowrap min-w-0 ${
                activeTab === 'calculator'
                  ? 'bg-[#F21B2D] hover:bg-[#D91424] text-white shadow-sm font-bold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-[#18181B] dark:hover:text-white hover:bg-white/80 dark:hover:bg-[#18181B]'
              }`}
            >
              <Beer className="w-4 h-4 shrink-0" />
              <span className="truncate">Drinks ({drinkCount})</span>
            </button>

            {/* 2. Center: Menu Scanner (Hero Feature) */}
            <button
              id="tour-nav-scanner"
              onClick={() => setActiveTab('scanner')}
              className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap min-w-0 ${
                activeTab === 'scanner'
                  ? 'bg-[#F21B2D] hover:bg-[#D91424] text-white shadow-sm font-bold'
                  : 'bg-[#FF8A8E]/15 hover:bg-[#FF8A8E]/25 text-[#D91424] dark:text-[#FF8A8E] border border-[#FF8A8E]/40 font-bold'
              }`}
            >
              <Camera className="w-4 h-4 shrink-0" />
              <span className="truncate">Scan Menu</span>
            </button>

            {/* 3. Right: Bar Hub */}
            <button
              onClick={() => setActiveTab('bars')}
              className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl transition-all whitespace-nowrap min-w-0 ${
                activeTab === 'bars'
                  ? 'bg-[#F21B2D] hover:bg-[#D91424] text-white shadow-sm font-bold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-[#18181B] dark:hover:text-white hover:bg-white/80 dark:hover:bg-[#18181B]'
              }`}
            >
              <Store className="w-4 h-4 shrink-0" />
              <span className="truncate">Bar Hub</span>
            </button>
          </nav>
        </div>
      </div>

      {/* COMPACT VENUE SCOPE SUB-BAR: Always 1 single row, scalable to 50+ bars */}
      <div className="bg-[#FFF2F3]/80 dark:bg-[#121214] border-t border-[#E4E4E7] dark:border-[#27272A] px-4 py-1.5 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 text-xs">
          {/* Left: Sitting At Selector + Quick Desktop Pills */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-zinc-500 dark:text-zinc-400 font-semibold flex items-center gap-1 shrink-0">
              <MapPin className="w-3.5 h-3.5 text-[#F21B2D] shrink-0" />
              <span className="hidden xs:inline">Sitting At:</span>
            </span>

            {/* Searchable Bar Picker Popover Container */}
            <div id="tour-sitting-at" ref={pickerRef} className="relative min-w-0 max-w-[240px] sm:max-w-[300px]">
              <button
                type="button"
                onClick={() => {
                  setIsPickerOpen((prev) => !prev);
                  setIsRenamingBar(false);
                  setIsAddingBar(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1 rounded-xl font-bold transition-all border text-left ${
                  activeBar === 'all'
                    ? 'bg-[#FFFFFF] dark:bg-[#18181B] hover:bg-zinc-50 dark:hover:bg-[#27272A] text-[#18181B] dark:text-white border-[#E4E4E7] dark:border-[#27272A]'
                    : 'bg-[#F21B2D] hover:bg-[#D91424] text-white border-[#F21B2D] shadow-sm'
                }`}
                aria-expanded={isPickerOpen}
                aria-haspopup="listbox"
              >
                <span className="flex items-center gap-1.5 min-w-0 truncate">
                  {activeBar === 'all' ? (
                    <Globe className="w-3.5 h-3.5 text-[#F21B2D] shrink-0" />
                  ) : (
                    <Store className="w-3.5 h-3.5 text-white shrink-0" />
                  )}
                  <span className="truncate">
                    {activeBar === 'all' ? 'All Bars' : activeBar}
                  </span>
                </span>

                <span className="flex items-center gap-1 shrink-0">
                  <span
                    className={`text-[10px] px-1.5 py-0.5 leading-none rounded-full tabular-nums ${
                      activeBar === 'all'
                        ? 'bg-[#FF8A8E]/20 text-[#D91424] dark:text-[#FF8A8E] font-bold'
                        : 'bg-white/20 text-white font-bold'
                    }`}
                  >
                    {activeBarDrinkCount}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-150 ${
                      isPickerOpen ? 'rotate-180' : ''
                    } ${activeBar === 'all' ? 'text-zinc-500 dark:text-zinc-400' : 'text-white'}`}
                  />
                </span>
              </button>

              {/* Dropdown Menu */}
              {isPickerOpen && (
                <div className="absolute left-0 mt-1.5 w-72 sm:w-80 bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  {/* Search / Quick Add Input */}
                  <div className="p-2 border-b border-[#E4E4E7] dark:border-[#27272A] bg-[#FFF2F3]/60 dark:bg-[#121214]">
                    <div className="relative flex items-center">
                      <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 pointer-events-none" />
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
                        className="w-full bg-[#FFFFFF] dark:bg-[#18181B] text-[#18181B] dark:text-white text-xs rounded-xl pl-8 pr-7 py-1.5 border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D] placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                      />
                      {barSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setBarSearchQuery('')}
                          className="absolute right-2 text-zinc-400 hover:text-[#18181B] dark:hover:text-white"
                          aria-label="Clear search"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Bar List */}
                  <div className="max-h-60 overflow-y-auto divide-y divide-[#E4E4E7]/60 dark:divide-[#27272A]/60">
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
                            ? 'bg-[#FF8A8E]/20 text-[#D91424] dark:text-[#FF8A8E] font-bold'
                            : 'text-[#18181B] dark:text-zinc-200 hover:bg-[#FFF2F3] dark:hover:bg-[#27272A]/60'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Globe className="w-3.5 h-3.5 text-[#F21B2D] shrink-0" />
                          <span>All Bars (Compare Global)</span>
                        </span>
                        <span className="text-[10px] tabular-nums font-semibold px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-[#27272A] text-zinc-600 dark:text-zinc-300">
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
                              ? 'bg-[#FF8A8E]/20 text-[#D91424] dark:text-[#FF8A8E] font-bold'
                              : 'text-[#18181B] dark:text-zinc-200 hover:bg-[#FFF2F3] dark:hover:bg-[#27272A]/60'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0 truncate">
                            <Store
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isSelected ? 'text-[#F21B2D]' : 'text-zinc-400'
                              }`}
                            />
                            <span className="truncate">{bar}</span>
                          </span>
                          <span
                            className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded-full shrink-0 ml-2 ${
                              isSelected
                                ? 'bg-[#F21B2D] text-white font-bold'
                                : 'bg-zinc-100 dark:bg-[#27272A] text-zinc-600 dark:text-zinc-400 font-semibold'
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}

                    {filteredBars.length === 0 && !canCreateFromSearch && (
                      <div className="px-3 py-4 text-center text-zinc-500 dark:text-zinc-400 text-xs">
                        No bars found.
                      </div>
                    )}
                  </div>

                  {/* Create New Bar from Search or Footer Button */}
                  <div className="p-2 border-t border-[#E4E4E7] dark:border-[#27272A] bg-[#FFF2F3]/60 dark:bg-[#121214]">
                    {canCreateFromSearch ? (
                      <button
                        type="button"
                        onClick={handleCreateFromSearch}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F21B2D] hover:bg-[#D91424] text-white font-bold text-xs transition-colors"
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
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFFFFF] dark:bg-[#18181B] hover:bg-[#FF8A8E]/15 text-[#F21B2D] font-semibold text-xs border border-[#E4E4E7] dark:border-[#27272A] transition-colors"
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
                className="px-2 py-1 rounded-xl text-[11px] font-semibold bg-[#FFFFFF] dark:bg-[#18181B] hover:bg-zinc-50 dark:hover:bg-[#27272A] text-[#18181B] dark:text-zinc-200 border border-[#E4E4E7] dark:border-[#27272A] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1"
              >
                <Globe className="w-3 h-3 text-[#F21B2D]" />
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
                      className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-[#FFFFFF] dark:bg-[#18181B] hover:bg-[#FF8A8E]/15 text-zinc-600 dark:text-zinc-300 hover:text-[#18181B] dark:hover:text-white border border-[#E4E4E7] dark:border-[#27272A] transition-colors whitespace-nowrap truncate max-w-[140px]"
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
                  className="bg-[#FFFFFF] dark:bg-[#18181B] text-[#18181B] dark:text-white text-xs rounded-lg px-2.5 py-1 border border-[#F21B2D] focus:outline-none w-32 sm:w-40"
                />
                <button
                  type="submit"
                  className="p-1 rounded-lg bg-[#F21B2D] text-white hover:bg-[#D91424]"
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
                  className="p-1 rounded-lg bg-[#FFFFFF] dark:bg-[#18181B] text-zinc-500 hover:text-[#18181B] dark:hover:text-white border border-[#E4E4E7] dark:border-[#27272A]"
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
                  className="bg-[#FFFFFF] dark:bg-[#18181B] text-[#18181B] dark:text-white text-xs rounded-lg px-2 py-0.5 border border-[#F21B2D] focus:outline-none w-28 sm:w-36"
                />
                <button
                  type="submit"
                  className="p-1 rounded-lg bg-[#F21B2D] text-white hover:bg-[#D91424]"
                  title="Confirm rename"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsRenamingBar(false)}
                  className="p-1 rounded-lg bg-[#FFFFFF] dark:bg-[#18181B] text-zinc-500 hover:text-[#18181B] dark:hover:text-white border border-[#E4E4E7] dark:border-[#27272A]"
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
                    className="p-1 px-2 rounded-xl font-semibold whitespace-nowrap border border-dashed border-[#E4E4E7] dark:border-[#27272A] hover:border-[#F21B2D] text-zinc-600 dark:text-zinc-300 hover:text-[#F21B2D] bg-[#FFFFFF] dark:bg-[#18181B] transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#F21B2D]" />
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
                        className="p-1 px-1.5 text-zinc-600 dark:text-zinc-300 hover:text-[#F21B2D] bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                        aria-label={`Rename bar ${activeBar}`}
                      >
                        <Pencil className="w-3.5 h-3.5 text-[#F21B2D]" />
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
                        className="p-1 px-1.5 text-zinc-500 dark:text-zinc-400 hover:text-[#F21B2D] bg-[#FFFFFF] dark:bg-[#18181B] hover:bg-[#FF8A8E]/15 border border-[#E4E4E7] dark:border-[#27272A] hover:border-[#F21B2D]/50 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                        aria-label={`Delete bar ${activeBar}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-[#F21B2D]" />
                        <span className="hidden md:inline text-[11px] font-semibold text-[#F21B2D]">
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

