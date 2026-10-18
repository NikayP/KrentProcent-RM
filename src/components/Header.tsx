import React, { useState } from 'react';
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
} from 'lucide-react';
import { DrinkItem, filterDrinksByBar } from '../utils/calculator';

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
  const [isAddingBar, setIsAddingBar] = useState(false);
  const [newBarInput, setNewBarInput] = useState('');
  const [isRenamingBar, setIsRenamingBar] = useState(false);
  const [renameInput, setRenameInput] = useState('');

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
  };

  return (
    <header className="sticky top-0 z-40 bg-stone-900/95 backdrop-blur-md border-b border-amber-900/40 text-stone-100 shadow-xl">
      <div className="max-w-6xl mx-auto px-4 py-3 sm:px-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 text-stone-950 font-black text-xl shrink-0">
              <Beer className="w-6 h-6 text-stone-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-1.5 whitespace-nowrap">
                  KrentProcent{' '}
                  <span className="text-amber-400 text-xs px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/30 shrink-0">
                    RM
                  </span>
                </h1>
                <span className="hidden sm:inline-block whitespace-nowrap text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md border border-amber-500/30 shrink-0">
                  v0.1.0
                </span>
                <span className="hidden lg:inline-block whitespace-nowrap text-[11px] font-medium bg-stone-800 text-stone-300 px-2.5 py-0.5 rounded-full border border-stone-700 shrink-0">
                  Bar Value Meter
                </span>
              </div>
              <p className="text-xs text-stone-400 font-medium">
                Most pure alcohol per coin at the bar &bull; Compare by venue &amp; menu
              </p>
            </div>
          </div>

          {/* Quick mobile controls */}
          <div className="flex items-center gap-2 md:hidden">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="bg-stone-800 text-amber-300 font-bold text-xs rounded-lg px-2.5 py-1.5 border border-stone-700 focus:outline-none focus:border-amber-500"
              aria-label="Currency"
            >
              <option value="€">€ EUR</option>
              <option value="$">$ USD</option>
              <option value="£">£ GBP</option>
              <option value="kr">kr SEK/NOK</option>
              <option value="CHF">CHF</option>
            </select>

            {drinkCount > 0 && (
              <button
                onClick={onReset}
                title="Reset all drinks and bars"
                className="p-1.5 text-stone-400 hover:text-rose-400 hover:bg-stone-800 rounded-lg transition-colors border border-stone-800"
                aria-label="Clear all drinks"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Desktop actions & Navigation */}
        <div className="flex items-center justify-between md:justify-end gap-2.5 min-w-0">
          {/* Navigation Tabs */}
          <nav className="flex items-center bg-stone-950/80 p-1 rounded-xl border border-stone-800 text-xs sm:text-sm font-semibold overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveTab('calculator')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                activeTab === 'calculator'
                  ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
              }`}
            >
              <Beer className="w-4 h-4" />
              <span>Drinks ({drinkCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('bars')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                activeTab === 'bars'
                  ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>Compare Bars ({availableBars.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('scanner')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                activeTab === 'scanner'
                  ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span className="flex items-center gap-1">
                Scan Menu{' '}
                <span className="hidden sm:inline text-[10px] bg-amber-400/20 text-amber-200 px-1 rounded">
                  AI
                </span>
              </span>
            </button>

            <button
              onClick={() => setActiveTab('duel')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                activeTab === 'duel'
                  ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
              }`}
            >
              <Swords className="w-4 h-4" />
              <span>1v1 Duel</span>
            </button>

            <button
              onClick={() => setActiveTab('group')}
              aria-label="Pitcher Saver Tab"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                activeTab === 'group'
                  ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
              }`}
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Pitcher Saver</span>
              <span className="sm:hidden">Pitcher</span>
            </button>
          </nav>

          {/* Currency select (desktop) */}
          <div className="hidden md:flex items-center gap-2">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="bg-stone-800 hover:bg-stone-750 text-amber-300 font-bold text-xs rounded-lg px-2.5 py-2 border border-stone-700 focus:outline-none focus:border-amber-500"
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
                className="p-2 text-stone-400 hover:text-rose-400 hover:bg-stone-800 rounded-lg transition-colors border border-stone-800"
                aria-label="Clear all drinks"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* VENUE SCOPE SUB-BAR: Which bar are you sitting at right now? */}
      <div className="bg-stone-950 border-t border-stone-850 px-4 py-2 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-stone-400 font-semibold flex items-center gap-1 shrink-0 mr-1">
              <span className="text-amber-400">📍</span> Sitting At:
            </span>

            {/* Quick bar chips */}
            <button
              type="button"
              onClick={() => {
                onSelectBar('all');
                setIsRenamingBar(false);
              }}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap ${
                activeBar === 'all'
                  ? 'bg-amber-500 text-stone-950 shadow-sm'
                  : 'bg-stone-900 text-stone-300 hover:bg-stone-800 border border-stone-800'
              }`}
            >
              🌐 All Bars ({drinkCount})
            </button>

            {availableBars.map((bar) => {
              const count = filterDrinksByBar(drinks, bar).length;
              return (
                <button
                  key={bar}
                  type="button"
                  onClick={() => {
                    onSelectBar(bar);
                    setIsRenamingBar(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all whitespace-nowrap border flex items-center gap-1.5 ${
                    activeBar === bar
                      ? 'bg-amber-400 text-stone-950 border-amber-300 font-bold shadow-sm'
                      : 'bg-stone-900 text-stone-300 hover:text-white border-stone-800 hover:border-stone-700'
                  }`}
                >
                  <span>{bar}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      activeBar === bar
                        ? 'bg-stone-950/20 text-stone-950 font-black'
                        : 'bg-stone-800 text-stone-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            {/* Add New Bar Inline Trigger */}
            {onAddBar && !isAddingBar && (
              <button
                type="button"
                onClick={() => {
                  setIsAddingBar(true);
                  setIsRenamingBar(false);
                }}
                title="Add a new bar venue"
                className="px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap border border-dashed border-stone-700 hover:border-amber-400/60 text-stone-400 hover:text-amber-300 bg-stone-900/50 transition-colors flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Bar</span>
              </button>
            )}

            {isAddingBar && (
              <form onSubmit={handleCreateBarSubmit} className="flex items-center gap-1 shrink-0">
                <input
                  type="text"
                  value={newBarInput}
                  onChange={(e) => setNewBarInput(e.target.value)}
                  placeholder="Bar name..."
                  autoFocus
                  className="bg-stone-900 text-white text-xs rounded-lg px-2.5 py-1 border border-amber-400 focus:outline-none w-36"
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

          <div className="text-[11px] text-stone-400 font-medium shrink-0 flex items-center gap-2">
            {activeBar === 'all' ? (
              <span>Viewing all drinks across all recorded bars</span>
            ) : isRenamingBar ? (
              <form onSubmit={handleRenameSubmit} className="flex items-center gap-1.5">
                <span className="text-stone-400">Rename to:</span>
                <input
                  type="text"
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  autoFocus
                  className="bg-stone-900 text-white text-xs rounded-md px-2 py-0.5 border border-amber-400 focus:outline-none w-40"
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
              <div className="flex items-center gap-1.5">
                <span>
                  Isolated to <strong className="text-amber-300">{activeBar}</strong>
                </span>
                {onRenameBar && (
                  <button
                    type="button"
                    onClick={startRenaming}
                    title={`Rename ${activeBar}`}
                    className="p-1 px-1.5 text-stone-300 hover:text-amber-300 bg-stone-900 hover:bg-stone-800 border border-stone-800 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                    aria-label={`Rename bar ${activeBar}`}
                  >
                    <Pencil className="w-3 h-3 text-amber-400" />
                    <span className="hidden sm:inline text-[10px] font-semibold">Rename</span>
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
                    className="p-1 px-1.5 text-stone-400 hover:text-rose-400 bg-stone-900 hover:bg-rose-950/60 border border-stone-800 hover:border-rose-800/80 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                    aria-label={`Delete bar ${activeBar}`}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span className="hidden sm:inline text-[10px] font-semibold text-rose-400">
                      Delete Bar
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
