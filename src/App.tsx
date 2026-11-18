import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { flushSync } from 'react-dom';
import { filterDrinksByBar, type DrinkItem } from './utils/calculator';
import { Header } from './components/Header';
import { BottomTabBar } from './components/BottomTabBar';
import { UpdatePrompt } from './components/UpdatePrompt';
import { DrinkForm } from './components/DrinkForm';
import { Leaderboard } from './components/Leaderboard';
import { ConfirmModal } from './components/ConfirmModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { lazyWithRetry } from './utils/lazyWithRetry';
import type { BarsSubTab } from './components/bars/BarsHub';
import { usePublicBarsSync } from './hooks/usePublicBarsSync';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import { useTheme } from './hooks/useTheme';
import { useToast } from './hooks/useToast';
import { useModalHistoryGuard } from './hooks/useModalHistoryGuard';
import { useDrinksBoard } from './hooks/useDrinksBoard';
import { useCloudSync } from './hooks/useCloudSync';
import { isAccountsEnabled } from './utils/supabase';
import { ShieldCheck, Info, Check, Sparkles, HelpCircle, Beer, X } from 'lucide-react';

const loadMenuScanner = () =>
  import('./components/MenuScanner').then((m) => ({ default: m.MenuScanner }));
const loadBarsHub = () =>
  import('./components/bars/BarsHub').then((m) => ({ default: m.BarsHub }));

const MenuScanner = lazyWithRetry(loadMenuScanner);
const BarsHub = lazyWithRetry(loadBarsHub);
const QuickTourModal = lazyWithRetry(() =>
  import('./components/QuickTourModal').then((m) => ({ default: m.QuickTourModal }))
);

const TabSkeleton: React.FC = () => (
  <div className="bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl p-6 space-y-4 animate-pulse">
    <div className="h-6 w-48 rounded-lg bg-[#FFF2F3] dark:bg-[#27272A]" />
    <div className="h-4 w-72 max-w-full rounded-lg bg-[#FFF2F3] dark:bg-[#27272A]" />
    <div className="h-36 w-full rounded-2xl bg-[#FFF2F3]/70 dark:bg-[#121214]" />
  </div>
);

const TOUR_STORAGE_KEY = 'krentprocent_has_seen_tour_v1';
const SUPPORT_DISMISSED_KEY = 'krentprocent_support_dismissed_v1';
const SUPPORT_URL = 'https://ko-fi.com/kwalister';

export default function App() {
  const currency = '€';
  const isOnline = useOnlineStatus();
  const { canInstall, promptInstall } = useInstallPrompt();
  const { theme, toggleTheme } = useTheme();
  const { toastMessage, showToast } = useToast();

  const {
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
  } = useDrinksBoard({ onShowToast: showToast });

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

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const docWithTransition = document as Document & {
        startViewTransition?: (cb: () => void) => void;
      };

      if (!prefersReducedMotion && typeof docWithTransition.startViewTransition === 'function') {
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

  // In-app confirmation dialog & tour state
  const [barPendingDelete, setBarPendingDelete] = useState<string | null>(null);
  const [resetPending, setResetPending] = useState<boolean>(false);
  const [deleteAccountPending, setDeleteAccountPending] = useState<boolean>(false);
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

  const handleCloseTour = useCallback(() => {
    setIsTourOpen(false);
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    } catch {
      // ignore storage errors
    }
  }, []);

  // Android / browser back gesture closes the topmost open modal before leaving the app
  const anyModalOpen =
    Boolean(barPendingDelete) ||
    resetPending ||
    deleteAccountPending ||
    isTourOpen;

  const handleModalBackClose = useCallback(() => {
    if (deleteAccountPending) setDeleteAccountPending(false);
    else if (resetPending) setResetPending(false);
    else if (barPendingDelete) setBarPendingDelete(null);
    else if (isTourOpen) handleCloseTour();
  }, [deleteAccountPending, resetPending, barPendingDelete, isTourOpen, handleCloseTour]);

  useModalHistoryGuard(anyModalOpen, handleModalBackClose);

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

  // Expose resetTour helper to window in dev mode for quick testing from DevTools console
  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return;
    const win = window as unknown as { resetTour?: () => void };
    win.resetTour = () => {
      try {
        localStorage.removeItem(TOUR_STORAGE_KEY);
      } catch {}
      console.log('[KrentProcent] Tour status reset. Reloading...');
      window.location.reload();
    };
    return () => {
      delete win.resetTour;
    };
  }, []);

  const handlePasswordRecovery = useCallback(() => {
    setBarsSubTab('account');
    setActiveTab('bars');
  }, []);

  const {
    session,
    username,
    setUsername,
    syncReady,
    syncStatus,
    isRecovery,
    handleBeforeAuth,
    handleAuthErrorReset,
    handleRecoveryComplete,
    handleDeleteAccount,
  } = useCloudSync({
    activeTab,
    drinks,
    managedBars,
    onApplyCloudBoard: applyCloudBoard,
    onPasswordRecovery: handlePasswordRecovery,
    onShowToast: showToast,
  });

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

  const onImportFromScanner = useCallback(
    (newDrinks: DrinkItem[]) => {
      handleImportDrinks(newDrinks, () => switchTab('calculator'));
    },
    [handleImportDrinks, switchTab]
  );

  const onRenameBar = useCallback(
    (oldName: string, newName: string) => {
      handleRenameBar(oldName, newName, syncRenamedPublicBar);
    },
    [handleRenameBar, syncRenamedPublicBar]
  );

  const handleResetAll = useCallback(() => {
    setResetPending(true);
  }, []);

  const confirmResetAll = useCallback(() => {
    resetAllImmediately();
    setResetPending(false);
    try {
      localStorage.removeItem(TOUR_STORAGE_KEY);
    } catch {}
    showToast('Cleared all drinks and bars from the board.');
  }, [resetAllImmediately, showToast]);

  const handleDeleteBar = useCallback((barNameToDelete: string) => {
    if (!barNameToDelete) return;
    setBarPendingDelete(barNameToDelete);
  }, []);

  const confirmDeleteBar = useCallback(() => {
    if (!barPendingDelete) return;
    deleteBarImmediately(barPendingDelete, syncDeletedPublicBar);
    setBarPendingDelete(null);
  }, [barPendingDelete, deleteBarImmediately, syncDeletedPublicBar]);

  const handleAdoptPublicBar = useCallback(
    (incomingDrinks: DrinkItem[], sourceUsername: string, barName: string) => {
      adoptPublicBar(incomingDrinks, sourceUsername, barName, () => switchTab('calculator'));
    },
    [adoptPublicBar, switchTab]
  );

  const pendingBarDrinksCount = useMemo(() => {
    if (!barPendingDelete) return 0;
    return filterDrinksByBar(drinks, barPendingDelete).length;
  }, [drinks, barPendingDelete]);

  const handleSelectBarFromComparison = useCallback(
    (barName: string) => {
      setActiveBar(barName);
      switchTab('calculator');
    },
    [setActiveBar, switchTab]
  );

  const confirmDeleteAccount = useCallback(async () => {
    setDeleteAccountPending(false);
    await handleDeleteAccount();
  }, [handleDeleteAccount]);

  const accountDisplayName = session
    ? username ||
      (typeof session.user.user_metadata?.username === 'string'
        ? session.user.user_metadata.username
        : null) ||
      session.user.email ||
      'Account'
    : null;

  const requestDeleteAccount = useCallback(() => setDeleteAccountPending(true), []);

  const sharedAccountProps = useMemo(
    () => ({
      session,
      username,
      syncStatus,
      isRecovery,
      onRecoveryComplete: handleRecoveryComplete,
      onBeforeAuth: handleBeforeAuth,
      onAuthErrorReset: handleAuthErrorReset,
      onRequestDeleteAccount: requestDeleteAccount,
      onUsernameChanged: setUsername,
      onShowToast: showToast,
      localDrinkCount: drinks.length,
    }),
    [
      session,
      username,
      syncStatus,
      isRecovery,
      handleRecoveryComplete,
      handleBeforeAuth,
      handleAuthErrorReset,
      requestDeleteAccount,
      setUsername,
      showToast,
      drinks.length,
    ]
  );

  const openAccountTab = useCallback(() => {
    setBarsSubTab('account');
    switchTab('bars');
  }, [switchTab]);

  const handleInstallApp = useCallback(async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      showToast('KrentProcent installed on your device!');
    }
  }, [promptInstall, showToast]);

  const cancelDeleteBar = useCallback(() => setBarPendingDelete(null), []);
  const cancelResetAll = useCallback(() => setResetPending(false), []);
  const cancelDeleteAccount = useCallback(() => setDeleteAccountPending(false), []);

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
        onRenameBar={onRenameBar}
        onDeleteBar={handleDeleteBar}
        theme={theme}
        onToggleTheme={toggleTheme}
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
        <div
          role="status"
          aria-live="polite"
          className="fixed top-[calc(env(safe-area-inset-top)+4rem)] right-4 left-4 sm:left-auto z-50 animate-kp-toast pointer-events-none"
        >
          <div className="bg-[#FFFFFF] dark:bg-[#18181B] border border-[#F21B2D]/40 text-[#18181B] dark:text-[#FFFFFF] text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 max-w-md ml-auto">
            <Check className="w-4 h-4 text-[#F21B2D] shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 sm:px-6 space-y-6">
        <ErrorBoundary
          key={activeTab}
          onBack={activeTab !== 'calculator' ? () => switchTab('calculator') : undefined}
          backLabel="Back to Drinks"
        >
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
                  !isUntouchedPreset)) && (
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
                availableBars={availableBars}
              />
            </div>
          )}

          {/* TAB 2: AI Menu Scanner (Central Feature) */}
          {activeTab === 'scanner' && (
            <Suspense fallback={<TabSkeleton />}>
              <MenuScanner
                onImportDrinks={onImportFromScanner}
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
                onRenameBar={onRenameBar}
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
        </ErrorBoundary>
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
        onCancel={cancelDeleteBar}
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
        onCancel={cancelResetAll}
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
        onCancel={cancelDeleteAccount}
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
