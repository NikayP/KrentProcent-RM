import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type DrinkItem,
  areBarNamesEquivalent,
  canonicalizeBarName,
  deduplicateDrinksPerBar,
  deleteDrinksForBar,
  getUniqueBars,
  mergeDrinksBatch,
  renameBarInDrinks,
  upsertDrinkInBar,
} from '../utils/calculator';
import { POPULAR_BAR_PRESETS } from '../presets/barData';
import { isUntouchedPresetBoard } from '../utils/syncSnapshot';
import { triggerHaptic } from '../utils/haptics';

const STORAGE_KEY = 'krentprocent_drinks_v2';
const MANAGED_BARS_KEY = 'krentprocent_bars_v2';
const ACTIVE_BAR_KEY = 'krentprocent_active_bar_v2';

interface UseDrinksBoardParams {
  onShowToast: (msg: string) => void;
}

export function useDrinksBoard({ onShowToast }: UseDrinksBoardParams) {
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

  const availableBars = useMemo(
    () => getUniqueBars(drinks, managedBars),
    [drinks, managedBars]
  );

  const isUntouchedPreset = useMemo(
    () => isUntouchedPresetBoard(drinks, managedBars),
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

  const drinksRef = useRef(drinks);
  const managedBarsRef = useRef(managedBars);
  const activeBarRef = useRef(activeBar);
  const availableBarsRef = useRef(availableBars);
  drinksRef.current = drinks;
  managedBarsRef.current = managedBars;
  activeBarRef.current = activeBar;
  availableBarsRef.current = availableBars;

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
      localStorage.setItem(ACTIVE_BAR_KEY, activeBar);
    } catch (e) {
      console.error('Failed to persist active bar', e);
    }
  }, [activeBar]);

  const applyCloudBoard = useCallback((nextDrinks: DrinkItem[], nextBars: string[]) => {
    setDrinks(nextDrinks);
    setManagedBars(nextBars);

    const uniqueBars = getUniqueBars(nextDrinks, nextBars);
    const curActive = activeBarRef.current;
    if (curActive !== 'all') {
      if (uniqueBars.length === 0) {
        setActiveBar('all');
      } else if (!uniqueBars.some((b) => areBarNamesEquivalent(b, curActive))) {
        setActiveBar(uniqueBars[0]);
      }
    }
  }, []);

  const handleAddDrink = useCallback(
    (newDrink: DrinkItem, mode: 'update_existing' | 'force_add' = 'update_existing') => {
      const curAvailable = availableBarsRef.current;
      const curActive = activeBarRef.current;
      const canonicalBar = canonicalizeBarName(newDrink.barName || curActive, curAvailable);
      const result = upsertDrinkInBar(
        drinksRef.current,
        { ...newDrink, barName: canonicalBar },
        mode,
        curAvailable
      );

      setDrinks(result.drinks);
      setManagedBars((prev) => getUniqueBars([], [...prev, canonicalBar]));
      triggerHaptic(10);

      if (curActive !== 'all' && !areBarNamesEquivalent(curActive, canonicalBar)) {
        setActiveBar(canonicalBar);
      }

      if (result.action === 'updated') {
        onShowToast(`Updated existing "${result.drink.name}" at ${canonicalBar}.`);
      } else if (result.action === 'unchanged_duplicate') {
        onShowToast(`"${result.drink.name}" was already on the menu at ${canonicalBar}.`);
      } else {
        onShowToast(`Added "${result.drink.name}" to ${canonicalBar}.`);
      }
    },
    [onShowToast]
  );

  const handleUpdateDrink = useCallback(
    (updatedDrink: DrinkItem) => {
      const canonicalBar = canonicalizeBarName(
        updatedDrink.barName || activeBarRef.current,
        availableBarsRef.current
      );
      const cleaned = { ...updatedDrink, barName: canonicalBar };

      setDrinks((prev) => {
        const mapped = prev.map((d) => (d.id === cleaned.id ? cleaned : d));
        return deduplicateDrinksPerBar(mapped, 'latest').drinks;
      });
      setManagedBars((prev) => getUniqueBars([], [...prev, canonicalBar]));
      onShowToast(`Saved changes to "${cleaned.name}".`);
    },
    [onShowToast]
  );

  const handleDeleteDrink = useCallback((id: string) => {
    triggerHaptic(8);
    setDrinks((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const handleImportDrinks = useCallback(
    (newDrinks: DrinkItem[], onDone?: () => void) => {
      const merged = mergeDrinksBatch(
        drinksRef.current,
        newDrinks,
        'update',
        availableBarsRef.current
      );
      setDrinks(merged.drinks);

      const targetBar = newDrinks[0]?.barName
        ? canonicalizeBarName(
            newDrinks[0].barName,
            getUniqueBars(merged.drinks, managedBarsRef.current)
          )
        : null;

      if (targetBar) {
        setManagedBars((prev) => getUniqueBars([], [...prev, targetBar]));
        setActiveBar(targetBar);
      }

      const parts: string[] = [];
      if (merged.addedCount > 0) parts.push(`${merged.addedCount} added`);
      if (merged.updatedCount > 0) parts.push(`${merged.updatedCount} updated`);
      if (merged.skippedCount > 0) parts.push(`${merged.skippedCount} duplicate(s) skipped`);

      triggerHaptic(12);
      onShowToast(`Menu imported (${parts.join(', ') || 'no changes'})!`);
      onDone?.();
    },
    [onShowToast]
  );

  const handleLoadPresets = useCallback(() => {
    const merged = mergeDrinksBatch(
      drinksRef.current,
      POPULAR_BAR_PRESETS,
      'update',
      availableBarsRef.current
    );
    setDrinks(merged.drinks);
    if (activeBarRef.current === 'all' || availableBarsRef.current.length === 0) {
      setActiveBar(POPULAR_BAR_PRESETS[0].barName || 'Café De Dokter');
    }
    onShowToast(
      merged.addedCount > 0
        ? `Loaded ${merged.addedCount} preset drinks across 3 bars!`
        : 'All preset drinks are already on your board.'
    );
  }, [onShowToast]);

  const handleAddBar = useCallback(
    (rawBarName: string) => {
      const trimmed = rawBarName.trim();
      if (!trimmed) return;
      const canonical = canonicalizeBarName(trimmed, availableBarsRef.current);
      setManagedBars((prev) => getUniqueBars([], [...prev, canonical]));
      setActiveBar(canonical);
      onShowToast(`Active bar set to "${canonical}".`);
    },
    [onShowToast]
  );

  const handleRenameBar = useCallback(
    (
      oldName: string,
      newName: string,
      onRenamed?: (oldName: string, canonicalNewName: string, nextDrinks: DrinkItem[]) => void
    ) => {
      const trimmedNew = newName.trim();
      if (!oldName || !trimmedNew || oldName === trimmedNew) return;

      const renameResult = renameBarInDrinks(
        drinksRef.current,
        oldName,
        trimmedNew,
        availableBarsRef.current
      );
      setDrinks(renameResult.drinks);

      setManagedBars((prev) => {
        const withoutOld = prev.filter((b) => !areBarNamesEquivalent(b, oldName));
        return getUniqueBars([], [...withoutOld, renameResult.canonicalNewName]);
      });

      if (
        activeBarRef.current !== 'all' &&
        areBarNamesEquivalent(activeBarRef.current, oldName)
      ) {
        setActiveBar(renameResult.canonicalNewName);
      }

      onRenamed?.(oldName, renameResult.canonicalNewName, renameResult.drinks);

      if (renameResult.mergedDuplicatesRemoved > 0) {
        onShowToast(
          `Merged "${oldName}" into "${renameResult.canonicalNewName}" (${renameResult.mergedDuplicatesRemoved} duplicate drink(s) consolidated).`
        );
      } else {
        onShowToast(`Renamed "${oldName}" to "${renameResult.canonicalNewName}".`);
      }
    },
    [onShowToast]
  );

  const deleteBarImmediately = useCallback(
    (barNameToDelete: string, onDeleted?: (barName: string) => void) => {
      setDrinks((prev) => deleteDrinksForBar(prev, barNameToDelete));
      setManagedBars((prev) => prev.filter((b) => !areBarNamesEquivalent(b, barNameToDelete)));

      if (
        activeBarRef.current !== 'all' &&
        areBarNamesEquivalent(activeBarRef.current, barNameToDelete)
      ) {
        setActiveBar('all');
      }

      onDeleted?.(barNameToDelete);
      onShowToast(`Deleted "${barNameToDelete}" and all of its drinks.`);
    },
    [onShowToast]
  );

  const resetAllImmediately = useCallback(() => {
    setDrinks([]);
    setManagedBars([]);
    setActiveBar('all');
  }, []);

  const adoptPublicBar = useCallback(
    (
      incomingDrinks: DrinkItem[],
      sourceUsername: string,
      barName: string,
      onDone?: () => void
    ) => {
      const merged = mergeDrinksBatch(
        drinksRef.current,
        incomingDrinks,
        'update',
        availableBarsRef.current
      );
      setDrinks(merged.drinks);

      const canonicalTarget = canonicalizeBarName(
        barName,
        getUniqueBars(merged.drinks, managedBarsRef.current)
      );
      setManagedBars((prev) => getUniqueBars([], [...prev, canonicalTarget]));
      setActiveBar(canonicalTarget);

      triggerHaptic(12);
      if (merged.updatedCount > 0) {
        onShowToast(
          `Updated "${canonicalTarget}" from @${sourceUsername} (${merged.addedCount} added, ${merged.updatedCount} updated).`
        );
      } else {
        onShowToast(`Added "${canonicalTarget}" from @${sourceUsername}!`);
      }
      onDone?.();
    },
    [onShowToast]
  );

  return {
    drinks,
    managedBars,
    activeBar,
    setActiveBar,
    availableBars,
    isUntouchedPreset,
    applyCloudBoard,
    handleAddDrink,
    handleUpdateDrink,
    handleDeleteDrink,
    handleImportDrinks,
    handleLoadPresets,
    handleAddBar,
    handleRenameBar,
    deleteBarImmediately,
    resetAllImmediately,
    adoptPublicBar,
  };
}
