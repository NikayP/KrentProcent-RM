import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  type DrinkItem,
  getUniqueBars,
  mergeDrinksBatch,
} from '../utils/calculator';
import {
  deleteOwnAccount,
  getSupabaseClient,
  getUsername,
  hasLikelySupabaseSession,
  isAccountsEnabled,
  loadUserData,
  saveUserData,
} from '../utils/supabase';
import {
  computeBoardSnapshot,
  isUntouchedPresetBoard,
} from '../utils/syncSnapshot';
import type { SyncStatus } from '../types/account';

const DIRTY_STORAGE_KEY = 'krentprocent_account_dirty_v1';

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

interface UseCloudSyncParams {
  activeTab: 'calculator' | 'scanner' | 'bars';
  drinks: DrinkItem[];
  managedBars: string[];
  onApplyCloudBoard: (nextDrinks: DrinkItem[], nextBars: string[]) => void;
  onPasswordRecovery: () => void;
  onShowToast: (msg: string) => void;
}

export function useCloudSync({
  activeTab,
  drinks,
  managedBars,
  onApplyCloudBoard,
  onPasswordRecovery,
  onShowToast,
}: UseCloudSyncParams) {
  const [session, setSession] = useState<Session | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [syncReady, setSyncReady] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [isRecovery, setIsRecovery] = useState<boolean>(false);

  const [supabaseEnabledForSession, setSupabaseEnabledForSession] = useState<boolean>(
    () => isAccountsEnabled && (hasLikelySupabaseSession() || activeTab === 'bars')
  );

  useEffect(() => {
    if (isAccountsEnabled && activeTab === 'bars' && !supabaseEnabledForSession) {
      setSupabaseEnabledForSession(true);
    }
  }, [activeTab, supabaseEnabledForSession]);

  const drinksRef = useRef(drinks);
  const managedBarsRef = useRef(managedBars);
  const sessionRef = useRef(session);
  const syncReadyRef = useRef(syncReady);
  const onApplyCloudBoardRef = useRef(onApplyCloudBoard);
  const onPasswordRecoveryRef = useRef(onPasswordRecovery);
  drinksRef.current = drinks;
  managedBarsRef.current = managedBars;
  sessionRef.current = session;
  syncReadyRef.current = syncReady;
  onApplyCloudBoardRef.current = onApplyCloudBoard;
  onPasswordRecoveryRef.current = onPasswordRecovery;

  const pendingAuthModeRef = useRef<'login' | 'register' | null>(null);
  const initializedUserIdRef = useRef<string | null>(null);
  const lastSyncedSnapshotRef = useRef<string | null>(null);
  const pendingRetryRef = useRef<'startup' | 'login' | null>(null);
  const pendingSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyAndRecordCloudBoard = useCallback(
    (nextDrinks: DrinkItem[], nextBars: string[]) => {
      lastSyncedSnapshotRef.current = computeBoardSnapshot(nextDrinks, nextBars);
      onApplyCloudBoardRef.current(nextDrinks, nextBars);
    },
    []
  );

  const persistToCloudNow = useCallback(
    (userId: string, nextDrinks: DrinkItem[], nextBars: string[]) => {
      const snapshot = computeBoardSnapshot(nextDrinks, nextBars);
      return saveUserData(userId, nextDrinks, nextBars)
        .then(() => {
          if (sessionRef.current?.user.id !== userId) return;
          lastSyncedSnapshotRef.current = snapshot;
          setSyncDirty(false);
          pendingRetryRef.current = null;
          setSyncStatus('saved');
        })
        .catch(() => {
          if (sessionRef.current?.user.id !== userId) return;
          setSyncStatus('offline');
        });
    },
    []
  );

  const syncOnRegister = useCallback(
    async (nextSession: Session) => {
      setSyncStatus('saving');
      try {
        const curDrinks = drinksRef.current;
        const curBars = managedBarsRef.current;
        await saveUserData(nextSession.user.id, curDrinks, curBars);
        lastSyncedSnapshotRef.current = computeBoardSnapshot(curDrinks, curBars);
        setSyncDirty(false);
        pendingRetryRef.current = null;
        setSyncStatus('saved');
        setSyncReady(true);
      } catch {
        setSyncDirty(true);
        setSyncStatus('offline');
        setSyncReady(true);
      }
    },
    []
  );

  const syncOnLogin = useCallback(
    async (nextSession: Session) => {
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

        applyAndRecordCloudBoard(nextDrinks, nextBars);
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
    },
    [applyAndRecordCloudBoard]
  );

  const syncOnStartup = useCallback(
    async (nextSession: Session) => {
      if (isSyncDirty()) {
        setSyncStatus('saving');
        try {
          const curDrinks = drinksRef.current;
          const curBars = managedBarsRef.current;
          await saveUserData(nextSession.user.id, curDrinks, curBars);
          lastSyncedSnapshotRef.current = computeBoardSnapshot(curDrinks, curBars);
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
        applyAndRecordCloudBoard(cloud.drinks, cloud.managedBars);
        setSyncDirty(false);
        pendingRetryRef.current = null;
        setSyncStatus('saved');
        setSyncReady(true);
      } catch {
        pendingRetryRef.current = 'startup';
        setSyncStatus('offline');
        setSyncReady(true);
      }
    },
    [applyAndRecordCloudBoard]
  );

  // Subscribe to Supabase auth session & recovery events only when needed
  useEffect(() => {
    if (!supabaseEnabledForSession) return;

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const resolveUsername = (nextSession: Session) => {
      const metaName =
        typeof nextSession.user.user_metadata?.username === 'string'
          ? nextSession.user.user_metadata.username
          : null;
      if (metaName) setUsername(metaName);
      void getUsername(nextSession.user.id).then((dbName) => {
        if (!cancelled && dbName) setUsername(dbName);
      });
    };

    void getSupabaseClient()
      .then((client) => {
        if (cancelled || !client) return;
        const { data } = client.auth.onAuthStateChange((event, nextSession) => {
          setSession(nextSession);

          if (event === 'PASSWORD_RECOVERY') {
            setIsRecovery(true);
            onPasswordRecoveryRef.current();
          }

          if (!nextSession) {
            if (pendingSaveTimerRef.current) {
              clearTimeout(pendingSaveTimerRef.current);
              pendingSaveTimerRef.current = null;
            }
            initializedUserIdRef.current = null;
            pendingAuthModeRef.current = null;
            pendingRetryRef.current = null;
            lastSyncedSnapshotRef.current = null;
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
        unsubscribe = () => data.subscription.unsubscribe();
      })
      .catch(() => {
        // Ignore offline SDK import errors; local data remains available
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [supabaseEnabledForSession, syncOnLogin, syncOnRegister, syncOnStartup]);

  // Debounced auto-save to cloud ONLY when snapshot actually differs from last synced state
  useEffect(() => {
    const activeUserId = sessionRef.current?.user.id;
    if (!isAccountsEnabled || !activeUserId || !syncReadyRef.current) return;

    const currentSnapshot = computeBoardSnapshot(drinks, managedBars);
    if (currentSnapshot === lastSyncedSnapshotRef.current) {
      return;
    }

    setSyncDirty(true);
    setSyncStatus('saving');

    if (pendingSaveTimerRef.current) {
      clearTimeout(pendingSaveTimerRef.current);
    }

    pendingSaveTimerRef.current = setTimeout(() => {
      pendingSaveTimerRef.current = null;
      if (sessionRef.current?.user.id !== activeUserId) return;
      void persistToCloudNow(activeUserId, drinks, managedBars);
    }, 600);

    return () => {
      if (pendingSaveTimerRef.current) {
        clearTimeout(pendingSaveTimerRef.current);
        pendingSaveTimerRef.current = null;
      }
    };
  }, [drinks, managedBars, persistToCloudNow]);

  // Flush pending cloud save immediately when PWA is backgrounded or closed
  useEffect(() => {
    if (!isAccountsEnabled || !session) return;

    const flushPendingSave = () => {
      const activeUserId = sessionRef.current?.user.id;
      if (!activeUserId || !syncReadyRef.current) return;
      if (!pendingSaveTimerRef.current && !isSyncDirty()) return;

      if (pendingSaveTimerRef.current) {
        clearTimeout(pendingSaveTimerRef.current);
        pendingSaveTimerRef.current = null;
      }

      const curDrinks = drinksRef.current;
      const curBars = managedBarsRef.current;
      if (computeBoardSnapshot(curDrinks, curBars) === lastSyncedSnapshotRef.current) {
        return;
      }
      void persistToCloudNow(activeUserId, curDrinks, curBars);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPendingSave();
      }
    };

    window.addEventListener('pagehide', flushPendingSave);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', flushPendingSave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session, persistToCloudNow]);

  // Retry pending cloud sync when browser regains connectivity
  useEffect(() => {
    if (!isAccountsEnabled || !session) return;

    const handleOnline = () => {
      if (isSyncDirty()) {
        setSyncStatus('saving');
        void persistToCloudNow(
          session.user.id,
          drinksRef.current,
          managedBarsRef.current
        );
      } else if (pendingRetryRef.current === 'login') {
        void syncOnLogin(session);
      } else if (pendingRetryRef.current === 'startup') {
        void syncOnStartup(session);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [session, persistToCloudNow, syncOnLogin, syncOnStartup]);

  const handleBeforeAuth = useCallback((mode: 'login' | 'register') => {
    pendingAuthModeRef.current = mode;
  }, []);

  const handleAuthErrorReset = useCallback(() => {
    pendingAuthModeRef.current = null;
  }, []);

  const handleRecoveryComplete = useCallback(() => {
    setIsRecovery(false);
    if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search
      );
    }
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    try {
      await deleteOwnAccount();
      if (pendingSaveTimerRef.current) {
        clearTimeout(pendingSaveTimerRef.current);
        pendingSaveTimerRef.current = null;
      }
      initializedUserIdRef.current = null;
      pendingRetryRef.current = null;
      lastSyncedSnapshotRef.current = null;
      setSession(null);
      setUsername(null);
      setSyncReady(false);
      setSyncStatus('idle');
      setSyncDirty(false);
      onShowToast('Account deleted. Your drinks remain saved on this device.');
    } catch (err) {
      onShowToast(err instanceof Error ? err.message : 'Could not delete account.');
    }
  }, [onShowToast]);

  return {
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
  };
}
