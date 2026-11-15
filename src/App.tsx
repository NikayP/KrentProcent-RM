import React, { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { flushSync } from 'react-dom';
import type { Session } from '@supabase/supabase-js';
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
import { BottomTabBar } from './components/BottomTabBar';
import { UpdatePrompt } from './components/UpdatePrompt';
import { DrinkForm } from './components/DrinkForm';
import { Leaderboard } from './components/Leaderboard';
import { ConfirmModal } from './components/ConfirmModal';
import type { SyncStatus } from './types/account';
import type { BarsSubTab } from './components/bars/BarsHub';
import { usePublicBarsSync } from './hooks/usePublicBarsSync';

const loadMenuScanner = () =>
  import('./components/MenuScanner').then((m) => ({ default: m.MenuScanner }));
const loadBarsHub = () =>
  import('./components/bars/BarsHub').then((m) => ({ default: m.BarsHub }));

const MenuScanner = lazy(loadMenuScanner);
const BarsHub = lazy(loadBarsHub);
const QuickTourModal = lazy(() =>
  import('./components/QuickTourModal').then((m) => ({ default: m.QuickTourModal }))
);

const TabSkeleton: React.FC = () => (
  <div className="bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl p-6 space-y-4 animate-pulse">
    <div className="h-6 w-48 rounded-lg bg-[#FFF2F3] dark:bg-[#27272A]" />
    <div className="h-4 w-72 max-w-full rounded-lg bg-[#FFF2F3] dark:bg-[#27272A]" />
    <div className="h-36 w-full rounded-2xl bg-[#FFF2F3]/70 dark:bg-[#121214]" />
  </div>
);
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import { triggerHaptic } from './utils/haptics';
import {
  supabase,
  isAccountsEnabled,
  getUsername,
  loadUserData,
  saveUserData,
  deleteOwnAccount,
} from './utils/supabase';
import { ShieldCheck, Info, Check, Sparkles, HelpCircle, Beer, X } from 'lucide-react';

const STORAGE_KEY = 'krentprocent_drinks_v2';
const MANAGED_BARS_KEY = 'krentprocent_bars_v2';
const ACTIVE_BAR_KEY = 'krentprocent_active_bar_v2';
const TOUR_STORAGE_KEY = 'krentprocent_has_seen_tour_v1';
const THEME_STORAGE_KEY = 'krentprocent_theme_v1';
const DIRTY_STORAGE_KEY = 'krentprocent_account_dirty_v1';
const SUPPORT_DISMISSED_KEY = 'krentprocent_support_dismissed_v1';
const SUPPORT_URL = 'https://ko-fi.com/kwalister';

function isSyncDirty(): boolean {
  try {
    return localStorage.getItem(DIRTY_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function setSyncDirty(dirty: boolean) {
  try {
    if (dirty) localStorage.setItem(DIRTY_STORAGE_KEY, '1');
    else localStorage.removeItem(DIRTY_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

function isUntouchedPresetBoard(
  currentDrinks: DrinkItem[],
  currentManagedBars: string[]
): boolean {
  return (
    currentManagedBars.length === 0 &&
    currentDrinks.length === POPULAR_BAR_PRESETS.length &&
    currentDrinks.every(
      (d, idx) =>
        d.id === POPULAR_BAR_PRESETS[idx]?.id &&
        d.price === POPULAR_BAR_PRESETS[idx]?.price
    )
  );
}

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

  const currency = '€';

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

  const [activeTab, setActiveTab] = useState<'calculator' | 'scanner' | 'bars'>(() => {
    if (typeof window === 'undefined') return 'calculator';
    const tabParam = new URLSearchParams(window.location.search).get('tab');
    if (tabParam === 'scanner' || tabParam === 'bars' || tabParam === 'calculator') {
      return tabParam;
    }
    return 'calculator';
  });

  const [barsSubTab, setBarsSubTab] = useState<BarsSubTab>(() => {
    if (typeof window === 'undefined') return 'my-bars';
    const subParam = new URLSearchParams(window.location.search).get('sub');
    if (subParam === 'discover' || subParam === 'account' || subParam === 'my-bars') {
      return subParam;
    }
    return 'my-bars';
  });

  const [discoverQuery, setDiscoverQuery] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('q') || '';
  });

  // Sync sub-tab & ?q= URL params cleanly so Discover links (e.g. ?tab=bars&sub=discover&q=@jan) are shareable
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (activeTab === 'bars') {
      url.searchParams.set('tab', 'bars');
      if (barsSubTab !== 'my-bars') url.searchParams.set('sub', barsSubTab);
      else url.searchParams.delete('sub');
      if (barsSubTab === 'discover' && discoverQuery.trim()) {
        url.searchParams.set('q', discoverQuery.trim());
      } else {
        url.searchParams.delete('q');
      }
    } else {
      url.searchParams.delete('sub');
      url.searchParams.delete('q');
      if (url.searchParams.has('tab')) {
        url.searchParams.set('tab', activeTab);
      }
    }
    const nextSearch = url.searchParams.toString();
    const nextRelative = url.pathname + (nextSearch ? `?${nextSearch}` : '') + url.hash;
    const currentRelative = window.location.pathname + window.location.search + window.location.hash;
    if (nextRelative !== currentRelative) {
      window.history.replaceState(window.history.state, '', nextRelative);
    }
  }, [activeTab, barsSubTab, discoverQuery]);

  const isOnline = useOnlineStatus();
  const { canInstall, promptInstall } = useInstallPrompt();

  const scrollPositionsRef = useRef<Record<'calculator' | 'scanner' | 'bars', number>>({
    calculator: 0,
    scanner: 0,
    bars: 0,
  });

  const switchTab = useCallback(
    (nextTab: 'calculator' | 'scanner' | 'bars') => {
      if (nextTab === activeTab) return;
      scrollPositionsRef.current[activeTab] = window.scrollY;

      const applyTab = () => {
        setActiveTab(nextTab);
      };

      const docWithTransition = document as Document & {
        startViewTransition?: (cb: () => void) => void;
      };

      if (typeof docWithTransition.startViewTransition === 'function') {
        try {
          docWithTransition.startViewTransition(() => {
            flushSync(applyTab);
          });
        } catch {
          applyTab();
        }
      } else {
        applyTab();
      }

      requestAnimationFrame(() => {
        window.scrollTo({
          top: scrollPositionsRef.current[nextTab] ?? 0,
          behavior: 'instant' as ScrollBehavior,
        });
      });
    },
    [activeTab]
  );

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    const themeColorMetas = Array.from(document.querySelectorAll('meta[name="theme-color"]'));
    const nextColor = theme === 'dark' ? '#18181B' : '#FFFFFF';
    if (themeColorMetas.length > 0) {
      themeColorMetas[0].removeAttribute('media');
      themeColorMetas[0].setAttribute('content', nextColor);
      themeColorMetas.slice(1).forEach((m) => m.remove());
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // In-app confirmation dialog state
  const [barPendingDelete, setBarPendingDelete] = useState<string | null>(null);
  const [resetPending, setResetPending] = useState<boolean>(false);
  const [deleteAccountPending, setDeleteAccountPending] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [supportDismissed, setSupportDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SUPPORT_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const forceSupportHint =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('support') === '1';

  const dismissSupport = useCallback(() => {
    setSupportDismissed(true);
    try {
      localStorage.setItem(SUPPORT_DISMISSED_KEY, '1');
    } catch {
      // ignore storage errors
    }
  }, []);

  // Account & cloud sync state (optional — inactive when Supabase env vars are absent)
  const [session, setSession] = useState<Session | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [syncReady, setSyncReady] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [isRecovery, setIsRecovery] = useState<boolean>(false);

  const drinksRef = useRef(drinks);
  const managedBarsRef = useRef(managedBars);
  const activeBarRef = useRef(activeBar);
  const sessionRef = useRef(session);
  const syncReadyRef = useRef(syncReady);
  drinksRef.current = drinks;
  managedBarsRef.current = managedBars;
  activeBarRef.current = activeBar;
  sessionRef.current = session;
  syncReadyRef.current = syncReady;

  const pendingAuthModeRef = useRef<'login' | 'register' | null>(null);
  const initializedUserIdRef = useRef<string | null>(null);
  const skipNextSyncRef = useRef<boolean>(false);
  const pendingRetryRef = useRef<'startup' | 'login' | null>(null);

  // Auto-launch quick tour on first visit (or when ?tour=1 URL query parameter is provided)
  const [isTourOpen, setIsTourOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tour') === '1' || params.get('tour') === 'true') {
        return true;
      }
      const hasSeen = localStorage.getItem(TOUR_STORAGE_KEY);
      return !hasSeen;
    } catch {
      return false;
    }
  });

  const handleCloseTour = () => {
    setIsTourOpen(false);
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    } catch {
      // ignore storage errors
    }
  };

  // Android / browser back gesture closes the topmost open modal before leaving the app
  const anyModalOpen =
    Boolean(barPendingDelete) ||
    resetPending ||
    deleteAccountPending ||
    isTourOpen;
  const pushedModalHistoryRef = useRef(false);
  const closingFromPopstateRef = useRef(false);

  useEffect(() => {
    if (anyModalOpen && !pushedModalHistoryRef.current) {
      pushedModalHistoryRef.current = true;
      window.history.pushState(
        { ...(window.history.state || {}), kpModal: true },
        '',
        window.location.href
      );
    } else if (!anyModalOpen && pushedModalHistoryRef.current) {
      pushedModalHistoryRef.current = false;
      if (!closingFromPopstateRef.current && window.history.state?.kpModal) {
        window.history.back();
      }
      closingFromPopstateRef.current = false;
    }
  }, [anyModalOpen]);

  useEffect(() => {
    const handlePopState = () => {
      if (!pushedModalHistoryRef.current) return;
      closingFromPopstateRef.current = true;
      pushedModalHistoryRef.current = false;

      if (deleteAccountPending) setDeleteAccountPending(false);
      else if (resetPending) setResetPending(false);
      else if (barPendingDelete) setBarPendingDelete(null);
      else if (isTourOpen) {
        handleCloseTour();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [deleteAccountPending, resetPending, barPendingDelete, isTourOpen]);

  // Ask browser for persistent storage once so local drinks aren't evicted under storage pressure
  const requestedPersistRef = useRef(false);
  useEffect(() => {
    if (requestedPersistRef.current) return;
    requestedPersistRef.current = true;
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      void navigator.storage.persist().catch(() => {});
    }
  }, []);

  // Prefetch lazy tab chunks once the browser is idle so tab switches feel instant
  useEffect(() => {
    const prefetch = () => {
      void loadMenuScanner();
      void loadBarsHub();
    };
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(prefetch, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(prefetch, 1200);
    return () => clearTimeout(timer);
  }, []);

  // Expose resetTour helper to window for effortless testing from DevTools console
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as unknown as { resetTour: () => void }).resetTour = () => {
        try {
          localStorage.removeItem(TOUR_STORAGE_KEY);
        } catch {}
        console.log('[KrentProcent] Tour status reset. Reloading...');
        window.location.reload();
      };
    }
  }, []);

  const showToast = (msg: string, duration = 3200) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, duration);
  };

  const {
    shareState,
    updatingBarKey,
    setBarPublic,
    handleBarRenamed: syncRenamedPublicBar,
    handleBarDeleted: syncDeletedPublicBar,
  } = usePublicBarsSync({
    session,
    syncReady,
    drinks,
    onShowToast: showToast,
  });

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
      localStorage.setItem(ACTIVE_BAR_KEY, activeBar);
    } catch (e) {
      console.error('Failed to persist active bar', e);
    }
  }, [activeBar]);

  const applyCloudBoard = (nextDrinks: DrinkItem[], nextBars: string[]) => {
    skipNextSyncRef.current = true;
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
  };

  const syncOnRegister = async (nextSession: Session) => {
    setSyncStatus('saving');
    try {
      await saveUserData(
        nextSession.user.id,
        drinksRef.current,
        managedBarsRef.current
      );
      setSyncDirty(false);
      pendingRetryRef.current = null;
      setSyncStatus('saved');
      setSyncReady(true);
    } catch {
      setSyncDirty(true);
      setSyncStatus('offline');
      setSyncReady(true);
    }
  };

  const syncOnLogin = async (nextSession: Session) => {
    setSyncStatus('saving');
    try {
      const cloud = await loadUserData(nextSession.user.id);
      const localDrinks = drinksRef.current;
      const localBars = managedBarsRef.current;

      let nextDrinks: DrinkItem[];
      let nextBars: string[];

      if (isUntouchedPresetBoard(localDrinks, localBars)) {
        nextDrinks = cloud.drinks;
        nextBars = cloud.managedBars;
      } else {
        const knownBars = getUniqueBars(cloud.drinks, [...cloud.managedBars, ...localBars]);
        const merged = mergeDrinksBatch(cloud.drinks, localDrinks, 'skip', knownBars);
        nextDrinks = merged.drinks;
        nextBars = getUniqueBars([], [...cloud.managedBars, ...localBars]);
      }

      applyCloudBoard(nextDrinks, nextBars);
      await saveUserData(nextSession.user.id, nextDrinks, nextBars);
      setSyncDirty(false);
      pendingRetryRef.current = null;
      setSyncStatus('saved');
      setSyncReady(true);
    } catch {
      pendingRetryRef.current = 'login';
      setSyncStatus('offline');
      setSyncReady(true);
    }
  };

  const syncOnStartup = async (nextSession: Session) => {
    if (isSyncDirty()) {
      setSyncStatus('saving');
      try {
        await saveUserData(
          nextSession.user.id,
          drinksRef.current,
          managedBarsRef.current
        );
        setSyncDirty(false);
        pendingRetryRef.current = null;
        setSyncStatus('saved');
        setSyncReady(true);
      } catch {
        setSyncStatus('offline');
        setSyncReady(true);
      }
      return;
    }

    setSyncStatus('saving');
    try {
      const cloud = await loadUserData(nextSession.user.id);
      applyCloudBoard(cloud.drinks, cloud.managedBars);
      setSyncDirty(false);
      pendingRetryRef.current = null;
      setSyncStatus('saved');
      setSyncReady(true);
    } catch {
      pendingRetryRef.current = 'startup';
      setSyncStatus('offline');
      setSyncReady(true);
    }
  };

  // Subscribe to Supabase auth session & recovery events
  useEffect(() => {
    if (!supabase) return;

    const resolveUsername = (nextSession: Session) => {
      const metaName =
        typeof nextSession.user.user_metadata?.username === 'string'
          ? nextSession.user.user_metadata.username
          : null;
      if (metaName) setUsername(metaName);
      void getUsername(nextSession.user.id).then((dbName) => {
        if (dbName) setUsername(dbName);
      });
    };

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);

      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
        setBarsSubTab('account');
        setActiveTab('bars');
      }

      if (!nextSession) {
        initializedUserIdRef.current = null;
        pendingAuthModeRef.current = null;
        pendingRetryRef.current = null;
        setUsername(null);
        setSyncReady(false);
        setSyncStatus('idle');
        setSyncDirty(false);
        return;
      }

      resolveUsername(nextSession);

      if (event === 'INITIAL_SESSION') {
        if (initializedUserIdRef.current !== nextSession.user.id) {
          initializedUserIdRef.current = nextSession.user.id;
          void syncOnStartup(nextSession);
        }
        return;
      }

      if (event === 'SIGNED_IN') {
        const mode = pendingAuthModeRef.current;
        pendingAuthModeRef.current = null;

        if (mode === 'register') {
          initializedUserIdRef.current = nextSession.user.id;
          void syncOnRegister(nextSession);
        } else if (mode === 'login') {
          initializedUserIdRef.current = nextSession.user.id;
          void syncOnLogin(nextSession);
        } else if (initializedUserIdRef.current !== nextSession.user.id) {
          initializedUserIdRef.current = nextSession.user.id;
          void syncOnLogin(nextSession);
        }
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  // Debounced auto-save to cloud ONLY when local drinks/managedBars actually change
  useEffect(() => {
    const activeSession = sessionRef.current;
    if (!supabase || !activeSession || !syncReadyRef.current) return;
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }

    setSyncDirty(true);
    setSyncStatus('saving');

    const timer = setTimeout(() => {
      void saveUserData(activeSession.user.id, drinks, managedBars)
        .then(() => {
          setSyncDirty(false);
          pendingRetryRef.current = null;
          setSyncStatus('saved');
        })
        .catch(() => {
          setSyncStatus('offline');
        });
    }, 600);

    return () => clearTimeout(timer);
  }, [drinks, managedBars]);

  // Retry pending cloud sync when browser regains connectivity
  useEffect(() => {
    if (!supabase || !session) return;

    const handleOnline = () => {
      if (isSyncDirty()) {
        setSyncStatus('saving');
        void saveUserData(
          session.user.id,
          drinksRef.current,
          managedBarsRef.current
        )
          .then(() => {
            setSyncDirty(false);
            pendingRetryRef.current = null;
            setSyncStatus('saved');
          })
          .catch(() => {
            setSyncStatus('offline');
          });
      } else if (pendingRetryRef.current === 'login') {
        void syncOnLogin(session);
      } else if (pendingRetryRef.current === 'startup') {
        void syncOnStartup(session);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [session]);

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
    triggerHaptic(10);

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
    triggerHaptic(8);
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

    triggerHaptic(12);
    showToast(`Menu imported (${parts.join(', ') || 'no changes'})!`);
    switchTab('calculator');
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

    syncRenamedPublicBar(oldName, renameResult.canonicalNewName, renameResult.drinks);

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
    try {
      localStorage.removeItem(TOUR_STORAGE_KEY);
    } catch {}
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

    syncDeletedPublicBar(barNameToDelete);
    showToast(`Deleted "${barNameToDelete}" and all of its drinks.`);
    setBarPendingDelete(null);
  };

  const handleAdoptPublicBar = (
    incomingDrinks: DrinkItem[],
    sourceUsername: string,
    barName: string
  ) => {
    const merged = mergeDrinksBatch(drinks, incomingDrinks, 'update', availableBars);
    setDrinks(merged.drinks);

    const canonicalTarget = canonicalizeBarName(
      barName,
      getUniqueBars(merged.drinks, managedBars)
    );
    setManagedBars((prev) => getUniqueBars([], [...prev, canonicalTarget]));
    setActiveBar(canonicalTarget);

    triggerHaptic(12);
    if (merged.updatedCount > 0) {
      showToast(
        `Updated "${canonicalTarget}" from @${sourceUsername} (${merged.addedCount} added, ${merged.updatedCount} updated).`
      );
    } else {
      showToast(`Added "${canonicalTarget}" from @${sourceUsername}!`);
    }
    switchTab('calculator');
  };

  const pendingBarDrinksCount = useMemo(() => {
    if (!barPendingDelete) return 0;
    return filterDrinksByBar(drinks, barPendingDelete).length;
  }, [drinks, barPendingDelete]);

  const handleSelectBarFromComparison = (barName: string) => {
    setActiveBar(barName);
    switchTab('calculator');
  };

  const confirmDeleteAccount = async () => {
    setDeleteAccountPending(false);
    try {
      await deleteOwnAccount();
      initializedUserIdRef.current = null;
      pendingRetryRef.current = null;
      setSession(null);
      setUsername(null);
      setSyncReady(false);
      setSyncStatus('idle');
      setSyncDirty(false);
      showToast('Account deleted. Your drinks remain saved on this device.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not delete account.');
    }
  };

  const accountDisplayName = session
    ? username ||
      (typeof session.user.user_metadata?.username === 'string'
        ? session.user.user_metadata.username
        : null) ||
      session.user.email ||
      'Account'
    : null;

  const sharedAccountProps = {
    session,
    username,
    syncStatus,
    isRecovery,
    onRecoveryComplete: () => {
      setIsRecovery(false);
      if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
        window.history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search
        );
      }
    },
    onBeforeAuth: (mode: 'login' | 'register') => {
      pendingAuthModeRef.current = mode;
    },
    onAuthErrorReset: () => {
      pendingAuthModeRef.current = null;
    },
    onRequestDeleteAccount: () => setDeleteAccountPending(true),
    onUsernameChanged: (newName: string) => setUsername(newName),
    onShowToast: showToast,
    localDrinkCount: drinks.length,
  };

  const openAccountTab = useCallback(() => {
    setBarsSubTab('account');
    switchTab('bars');
  }, [switchTab]);

  const handleInstallApp = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      showToast('KrentProcent installed on your device!');
    }
  };

  return (
    <div className="min-h-dvh bg-[#FFF2F3] dark:bg-[#121214] text-[#18181B] dark:text-[#FFFFFF] flex flex-col font-sans selection:bg-[#F21B2D] selection:text-white transition-colors duration-200">
      {/* Sticky Top Header with Venue Switcher */}
      <Header
        activeTab={activeTab}
        setActiveTab={switchTab}
        drinkCount={drinks.length}
        drinks={drinks}
        onReset={handleResetAll}
        activeBar={activeBar}
        availableBars={availableBars}
        onSelectBar={setActiveBar}
        onAddBar={handleAddBar}
        onRenameBar={handleRenameBar}
        onDeleteBar={handleDeleteBar}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        accountName={accountDisplayName}
        syncStatus={syncStatus}
        onOpenAccount={isAccountsEnabled ? openAccountTab : undefined}
        isAccountActive={activeTab === 'bars' && barsSubTab === 'account'}
        canInstall={canInstall}
        onInstallApp={handleInstallApp}
        isOnline={isOnline}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-[calc(env(safe-area-inset-top)+4rem)] right-4 left-4 sm:left-auto z-50 animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-none">
          <div className="bg-[#FFFFFF] dark:bg-[#18181B] border border-[#F21B2D]/40 text-[#18181B] dark:text-[#FFFFFF] text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 max-w-md ml-auto">
            <Check className="w-4 h-4 text-[#F21B2D] shrink-0" />
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
            {(forceSupportHint ||
              (!supportDismissed &&
                !isTourOpen &&
                drinks.length >= 3 &&
                !isUntouchedPresetBoard(drinks, managedBars))) && (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#E4E4E7] dark:border-[#27272A] bg-[#FFFFFF]/90 dark:bg-[#18181B]/90 px-4 py-2.5 text-xs text-zinc-600 dark:text-zinc-400">
                <div className="flex items-center gap-2 min-w-0">
                  <Beer className="w-3.5 h-3.5 text-[#F21B2D] shrink-0" />
                  <span className="leading-snug">Enjoying KrentProcent?</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={SUPPORT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={dismissSupport}
                    className="px-2.5 py-1 rounded-lg bg-[#FFF2F3] dark:bg-[#121214] hover:bg-[#FF8A8E]/20 text-[#D91424] dark:text-[#FF8A8E] border border-[#E4E4E7] dark:border-[#27272A] font-semibold transition-colors whitespace-nowrap"
                  >
                    Buy me a beer
                  </a>
                  <button
                    type="button"
                    onClick={dismissSupport}
                    className="p-1 rounded-lg text-zinc-400 hover:text-[#18181B] dark:hover:text-white transition-colors cursor-pointer"
                    aria-label="Dismiss support message"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
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

        {/* TAB 2: AI Menu Scanner (Central Feature) */}
        {activeTab === 'scanner' && (
          <Suspense fallback={<TabSkeleton />}>
            <MenuScanner
              onImportDrinks={handleImportDrinks}
              existingDrinks={drinks}
              currency={currency}
              activeBar={activeBar}
              availableBars={availableBars}
            />
          </Suspense>
        )}

        {/* TAB 3: My Bars, Discover & Account Hub */}
        {activeTab === 'bars' && (
          <Suspense fallback={<TabSkeleton />}>
            <BarsHub
              subTab={barsSubTab}
              onSelectSubTab={setBarsSubTab}
              discoverQuery={discoverQuery}
              onDiscoverQueryChange={setDiscoverQuery}
              isAccountsEnabled={isAccountsEnabled}
              drinks={drinks}
              extraBars={managedBars}
              availableBars={availableBars}
              currency={currency}
              onSelectBar={handleSelectBarFromComparison}
              onAddBar={handleAddBar}
              onRenameBar={handleRenameBar}
              onDeleteBar={handleDeleteBar}
              shareState={shareState}
              updatingBarKey={updatingBarKey}
              onSetBarPublic={setBarPublic}
              accountDisplayName={accountDisplayName}
              onAdoptBar={handleAdoptPublicBar}
              accountProps={sharedAccountProps}
            />
          </Suspense>
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

      {/* In-App Confirmation Modal: Delete Account */}
      <ConfirmModal
        isOpen={deleteAccountPending}
        title="Delete Your Account?"
        message="This permanently removes your account and cloud backup. Your drinks will stay saved locally on this device."
        confirmLabel="Delete Account"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={confirmDeleteAccount}
        onCancel={() => setDeleteAccountPending(false)}
      />

      {/* Interactieve Snelle Rondleiding Modal */}
      {isTourOpen && (
        <Suspense fallback={null}>
          <QuickTourModal
            isOpen={isTourOpen}
            onClose={handleCloseTour}
            onNavigateTab={switchTab}
          />
        </Suspense>
      )}

      {/* Footer & Fallback / Preset Restore Bar */}
      <footer className="mt-auto border-t border-[#E4E4E7] dark:border-[#27272A] bg-[#FFFFFF]/80 dark:bg-[#18181B]/90 pt-6 pb-[calc(5.25rem+env(safe-area-inset-bottom))] sm:py-6 text-xs text-zinc-500 dark:text-zinc-400">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-zinc-600 dark:text-zinc-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#F21B2D]" />
              <span>KrentProcent &bull; Mathematical Alcohol Efficiency Engine</span>
            </div>
            <button
              type="button"
              onClick={handleLoadPresets}
              className="text-[11px] text-[#F21B2D] hover:text-[#D91424] font-semibold underline flex items-center gap-1 cursor-pointer"
              title="Restore or merge standard preset bars and drinks"
            >
              <Sparkles className="w-3 h-3" />
              <span>Restore Presets</span>
            </button>
            <button
              type="button"
              onClick={() => setIsTourOpen(true)}
              className="text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-[#18181B] dark:hover:text-white font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              title="Replay the quick tour"
            >
              <HelpCircle className="w-3 h-3" />
              <span>Quick Tour</span>
            </button>
            <a
              href={SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={dismissSupport}
              className="text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-[#F21B2D] dark:hover:text-[#FF8A8E] font-semibold flex items-center gap-1 transition-colors"
              title="Buy me a beer on Ko-fi"
            >
              <Beer className="w-3 h-3" />
              <span>Buy me a beer</span>
            </a>
          </div>

          <div className="text-center sm:text-right text-zinc-600 dark:text-zinc-400 max-w-md flex items-center gap-1.5 justify-center sm:justify-end">
            <Info className="w-3.5 h-3.5 text-[#F21B2D] shrink-0" />
            <span>
              For informational and social calculation fun. Know your personal limits &amp; enjoy
              responsibly.
            </span>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Tab Bar */}
      <BottomTabBar
        activeTab={activeTab}
        onSelectTab={switchTab}
      />

      {/* PWA Update Toast */}
      <UpdatePrompt />
    </div>
  );
}
