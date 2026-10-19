import React, { useState, useEffect, useMemo } from 'react';
import {
  DrinkItem,
  getUniqueBars,
  deleteDrinksForBar,
  canonicalizeBarName,
  areBarNamesEquivalent,
  filterDrinksByBar,
  deduplicateDrinksPerBar,
  upsertDrinkInBar,
  mergeDrinksBatch,
  renameBarInDrinks,
} from './utils/calculator';
import { POPULAR_BAR_PRESETS } from './presets/barData';
import { Header } from './components/Header';
import { DrinkForm } from './components/DrinkForm';
import { Leaderboard } from './components/Leaderboard';
import { MenuScanner } from './components/MenuScanner';
import { CrossBarComparison } from './components/CrossBarComparison';
import { ConfirmModal } from './components/ConfirmModal';
import { ShieldCheck, Info, Check, Sparkles } from 'lucide-react';

const STORAGE_KEY = 'krentprocent_rm_drinks_v2';
const MANAGED_BARS_KEY = 'krentprocent_rm_bars_v2';
const CURRENCY_KEY = 'krentprocent_rm_currency_v2';
const ACTIVE_BAR_KEY = 'krentprocent_rm_active_bar_v2';

export default function App() {
  const [drinks, setDrinks] = useState<DrinkItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return deduplicateDrinksPerBar(parsed, 'first').drinks;
        }
      }
    } catch (e) {
      console.error('Failed to load drinks from localStorage', e);
    }
    // Default initial seed with realistic pub items across multiple bars
    return POPULAR_BAR_PRESETS;
  });

  const [managedBars, setManagedBars] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(MANAGED_BARS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((b): b is string => typeof b === 'string' && b.trim().length > 0);
        }
      }
    } catch (e) {
      console.error('Failed to load managed bars from localStorage', e);
    }
    return [];
  });

  const [currency, setCurrency] = useState<string>(() => {
    return localStorage.getItem(CURRENCY_KEY) || '€';
  });

  // Calculate unique list of bars (strictly deduplicated and accent-insensitive)
  const availableBars = useMemo(
    () => getUniqueBars(drinks, managedBars),
    [drinks, managedBars]
  );

  const [activeBar, setActiveBar] = useState<string>(() => {
    const saved = localStorage.getItem(ACTIVE_BAR_KEY);
    if (saved) {
      if (saved === 'all') return 'all';
      return canonicalizeBarName(saved, availableBars);
    }
    return availableBars[0] || 'Café De Dokter';
  });

  const [activeTab, setActiveTab] = useState<'calculator' | 'scanner' | 'bars'>(
    'calculator'
  );

  // In-app confirmation dialog state
  const [barPendingDelete, setBarPendingDelete] = useState<string | null>(null);
  const [resetPending, setResetPending] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string, duration = 3200) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, duration);
  };

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(drinks));
    } catch (e) {
      console.error('Failed to persist drinks', e);
    }
  }, [drinks]);

  useEffect(() => {
    try {
      localStorage.setItem(MANAGED_BARS_KEY, JSON.stringify(managedBars));
    } catch (e) {
      console.error('Failed to persist managed bars', e);
    }
  }, [managedBars]);

  useEffect(() => {
    try {
      localStorage.setItem(CURRENCY_KEY, currency);
    } catch (e) {
      console.error('Failed to persist currency', e);
    }
  }, [currency]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_BAR_KEY, activeBar);
    } catch (e) {
      console.error('Failed to persist active bar', e);
    }
  }, [activeBar]);

  const handleAddDrink = (
    newDrink: DrinkItem,
    mode: 'update_existing' | 'force_add' = 'update_existing'
  ) => {
    const canonicalBar = canonicalizeBarName(newDrink.barName || activeBar, availableBars);
    const result = upsertDrinkInBar(
      drinks,
      { ...newDrink, barName: canonicalBar },
      mode,
      availableBars
    );

    setDrinks(result.drinks);
    setManagedBars((prev) => getUniqueBars([], [...prev, canonicalBar]));

    if (activeBar !== 'all' && !areBarNamesEquivalent(activeBar, canonicalBar)) {
      setActiveBar(canonicalBar);
    }

    if (result.action === 'updated') {
      showToast(`Updated existing "${result.drink.name}" at ${canonicalBar}.`);
    } else if (result.action === 'unchanged_duplicate') {
      showToast(`"${result.drink.name}" was already on the menu at ${canonicalBar}.`);
    } else {
      showToast(`Added "${result.drink.name}" to ${canonicalBar}.`);
    }
  };

  const handleUpdateDrink = (updatedDrink: DrinkItem) => {
    const canonicalBar = canonicalizeBarName(
      updatedDrink.barName || activeBar,
      availableBars
    );
    const cleaned = { ...updatedDrink, barName: canonicalBar };

    setDrinks((prev) => {
      const mapped = prev.map((d) => (d.id === cleaned.id ? cleaned : d));
      return deduplicateDrinksPerBar(mapped, 'latest').drinks;
    });
    setManagedBars((prev) => getUniqueBars([], [...prev, canonicalBar]));
    showToast(`Saved changes to "${cleaned.name}".`);
  };

  const handleDeleteDrink = (id: string) => {
    setDrinks((prev) => prev.filter((d) => d.id !== id));
  };

  const handleImportDrinks = (newDrinks: DrinkItem[]) => {
    const merged = mergeDrinksBatch(drinks, newDrinks, 'update', availableBars);
    setDrinks(merged.drinks);

    const targetBar = newDrinks[0]?.barName
      ? canonicalizeBarName(newDrinks[0].barName, getUniqueBars(merged.drinks, managedBars))
      : null;

    if (targetBar) {
      setManagedBars((prev) => getUniqueBars([], [...prev, targetBar]));
      setActiveBar(targetBar);
    }

    const parts: string[] = [];
    if (merged.addedCount > 0) parts.push(`${merged.addedCount} added`);
    if (merged.updatedCount > 0) parts.push(`${merged.updatedCount} updated`);
    if (merged.skippedCount > 0) parts.push(`${merged.skippedCount} duplicate(s) skipped`);

    showToast(`Menu imported (${parts.join(', ') || 'no changes'})!`);
    setActiveTab('calculator');
  };

  const handleLoadPresets = () => {
    const merged = mergeDrinksBatch(drinks, POPULAR_BAR_PRESETS, 'update', availableBars);
    setDrinks(merged.drinks);
    if (activeBar === 'all' || availableBars.length === 0) {
      setActiveBar(POPULAR_BAR_PRESETS[0].barName || 'Café De Dokter');
    }
    showToast(
      merged.addedCount > 0
        ? `Loaded ${merged.addedCount} preset drinks across 3 bars!`
        : 'All preset drinks are already on your board.'
    );
  };

  const handleAddBar = (rawBarName: string) => {
    const trimmed = rawBarName.trim();
    if (!trimmed) return;
    const canonical = canonicalizeBarName(trimmed, availableBars);
    setManagedBars((prev) => getUniqueBars([], [...prev, canonical]));
    setActiveBar(canonical);
    showToast(`Active bar set to "${canonical}".`);
  };

  const handleRenameBar = (oldName: string, newName: string) => {
    const trimmedNew = newName.trim();
    if (!oldName || !trimmedNew || oldName === trimmedNew) return;

    const renameResult = renameBarInDrinks(drinks, oldName, trimmedNew, availableBars);
    setDrinks(renameResult.drinks);

    setManagedBars((prev) => {
      const withoutOld = prev.filter((b) => !areBarNamesEquivalent(b, oldName));
      return getUniqueBars([], [...withoutOld, renameResult.canonicalNewName]);
    });

    if (activeBar !== 'all' && areBarNamesEquivalent(activeBar, oldName)) {
      setActiveBar(renameResult.canonicalNewName);
    }

    if (renameResult.mergedDuplicatesRemoved > 0) {
      showToast(
        `Merged "${oldName}" into "${renameResult.canonicalNewName}" (${renameResult.mergedDuplicatesRemoved} duplicate drink(s) consolidated).`
      );
    } else {
      showToast(`Renamed "${oldName}" to "${renameResult.canonicalNewName}".`);
    }
  };

  const handleResetAll = () => {
    setResetPending(true);
  };

  const confirmResetAll = () => {
    setDrinks([]);
    setManagedBars([]);
    setActiveBar('all');
    setResetPending(false);
    showToast('Cleared all drinks and bars from the board.');
  };

  const handleDeleteBar = (barNameToDelete: string) => {
    if (!barNameToDelete) return;
    setBarPendingDelete(barNameToDelete);
  };

  const confirmDeleteBar = () => {
    if (!barPendingDelete) return;
    const barNameToDelete = barPendingDelete;

    setDrinks((prev) => deleteDrinksForBar(prev, barNameToDelete));
    setManagedBars((prev) => prev.filter((b) => !areBarNamesEquivalent(b, barNameToDelete)));

    if (activeBar !== 'all' && areBarNamesEquivalent(activeBar, barNameToDelete)) {
      setActiveBar('all');
    }

    showToast(`Deleted "${barNameToDelete}" and all of its drinks.`);
    setBarPendingDelete(null);
  };

  const pendingBarDrinksCount = useMemo(() => {
    if (!barPendingDelete) return 0;
    return filterDrinksByBar(drinks, barPendingDelete).length;
  }, [drinks, barPendingDelete]);

  const handleSelectBarFromComparison = (barName: string) => {
    setActiveBar(barName);
    setActiveTab('calculator');
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans selection:bg-amber-500 selection:text-stone-950">
      {/* Sticky Top Header with Venue Switcher */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currency={currency}
        setCurrency={setCurrency}
        drinkCount={drinks.length}
        drinks={drinks}
        onReset={handleResetAll}
        activeBar={activeBar}
        availableBars={availableBars}
        onSelectBar={setActiveBar}
        onAddBar={handleAddBar}
        onRenameBar={handleRenameBar}
        onDeleteBar={handleDeleteBar}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 right-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="bg-stone-900 border border-amber-500/50 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 sm:px-6 space-y-6">
        {/* TAB 1: Calculator & Leaderboard */}
        {activeTab === 'calculator' && (
          <div className="space-y-6">
            <DrinkForm
              onAddDrink={handleAddDrink}
              existingDrinks={drinks}
              currency={currency}
              activeBar={activeBar}
              availableBars={availableBars}
              onSelectBar={setActiveBar}
            />
            <Leaderboard
              drinks={drinks}
              currency={currency}
              onDeleteDrink={handleDeleteDrink}
              onUpdateDrink={handleUpdateDrink}
              onLoadPresets={handleLoadPresets}
              activeBar={activeBar}
              onSelectBar={setActiveBar}
              onDeleteBar={handleDeleteBar}
              availableBars={availableBars}
            />
          </div>
        )}

        {/* TAB 2: Compare & Manage Bars */}
        {activeTab === 'bars' && (
          <CrossBarComparison
            drinks={drinks}
            extraBars={managedBars}
            currency={currency}
            onSelectBar={handleSelectBarFromComparison}
            onAddBar={handleAddBar}
            onRenameBar={handleRenameBar}
            onDeleteBar={handleDeleteBar}
          />
        )}

        {/* TAB 3: AI Menu Scanner */}
        {activeTab === 'scanner' && (
          <MenuScanner
            onImportDrinks={handleImportDrinks}
            existingDrinks={drinks}
            currency={currency}
            activeBar={activeBar}
            availableBars={availableBars}
          />
        )}
      </main>

      {/* In-App Confirmation Modal: Delete Bar */}
      <ConfirmModal
        isOpen={Boolean(barPendingDelete)}
        title={`Delete "${barPendingDelete}"?`}
        message={`Are you sure you want to delete "${barPendingDelete}"? This will permanently remove the bar and all ${pendingBarDrinksCount} drink(s) recorded for it from your board.`}
        confirmLabel="Delete Bar"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={confirmDeleteBar}
        onCancel={() => setBarPendingDelete(null)}
      />

      {/* In-App Confirmation Modal: Reset All */}
      <ConfirmModal
        isOpen={resetPending}
        title="Clear All Drinks & Bars?"
        message="This will reset your board, removing all drinks and custom bar menus you have recorded."
        confirmLabel="Clear Everything"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={confirmResetAll}
        onCancel={() => setResetPending(false)}
      />

      {/* Footer & Fallback / Preset Restore Bar */}
      <footer className="mt-auto border-t border-stone-800/80 bg-stone-900/60 py-6 text-xs text-stone-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-stone-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>KrentProcent RM &bull; Mathematical Alcohol Efficiency Engine</span>
            </div>
            <button
              type="button"
              onClick={handleLoadPresets}
              className="text-[11px] text-amber-400 hover:text-amber-300 underline flex items-center gap-1"
              title="Restore or merge standard preset bars and drinks"
            >
              <Sparkles className="w-3 h-3" />
              <span>Restore Presets</span>
            </button>
          </div>

          <div className="text-center sm:text-right text-stone-400 max-w-md flex items-center gap-1.5 justify-center sm:justify-end">
            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              For informational and social calculation fun. Know your personal limits &amp; enjoy
              responsibly.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
