import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { type DrinkItem, normalizeBarKey } from '../utils/calculator';
import {
  type MyPublicBar,
  fetchMyPublicBars,
  publishBar,
  unpublishBar,
} from '../utils/publicBars';
import { hashBarDrinks, preparePublicDrinks, sanitizeCity } from '../utils/publicBarsCore';
import { supabase } from '../utils/supabase';

export interface BarShareInfo {
  isPublic: boolean;
  city: string | null;
}

interface UsePublicBarsSyncParams {
  session: Session | null;
  syncReady: boolean;
  drinks: DrinkItem[];
  onShowToast: (msg: string) => void;
}

export function usePublicBarsSync({
  session,
  syncReady,
  drinks,
  onShowToast,
}: UsePublicBarsSyncParams) {
  const [publicBarsMap, setPublicBarsMap] = useState<Record<string, MyPublicBar>>({});
  const [updatingBarKey, setUpdatingBarKey] = useState<string | null>(null);

  const mapRef = useRef(publicBarsMap);
  const drinksRef = useRef(drinks);
  const sessionRef = useRef(session);
  mapRef.current = publicBarsMap;
  drinksRef.current = drinks;
  sessionRef.current = session;

  // Load current user's public bars on login; clear on logout
  useEffect(() => {
    if (!supabase || !session?.user?.id) {
      setPublicBarsMap({});
      setUpdatingBarKey(null);
      return;
    }

    let cancelled = false;
    const userId = session.user.id;
    void fetchMyPublicBars(userId)
      .then((rows) => {
        if (cancelled) return;
        const next: Record<string, MyPublicBar> = {};
        for (const row of rows) {
          next[row.barKey] = row;
        }
        setPublicBarsMap(next);
      })
      .catch(() => {
        // Keep silent if offline; user can still use My Bars normally
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  // Auto-sync modified drinks for bars the user chose to make public
  useEffect(() => {
    const userId = session?.user?.id;
    if (!supabase || !userId || !syncReady) return;

    const currentEntries = Object.values(mapRef.current);
    if (currentEntries.length === 0) return;

    const timer = setTimeout(() => {
      for (const pub of Object.values(mapRef.current)) {
        const prepared = preparePublicDrinks(drinks, pub.barName);
        const nextHash = hashBarDrinks(prepared);
        if (nextHash !== pub.hash) {
          void publishBar({
            userId,
            barName: pub.barName,
            city: pub.city,
            drinks,
          })
            .then((saved) => {
              setPublicBarsMap((prev) => ({
                ...prev,
                [saved.barKey]: saved,
              }));
            })
            .catch(() => {
              // Silent retry on next change
            });
        }
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [drinks, session?.user?.id, syncReady]);

  const setBarPublic = useCallback(
    async (barName: string, isPublic: boolean, city: string | null) => {
      const userId = sessionRef.current?.user?.id;
      if (!supabase || !userId) return;

      const barKey = normalizeBarKey(barName);
      const existing = mapRef.current[barKey];
      setUpdatingBarKey(barKey);

      try {
        if (isPublic) {
          const cleanCity = sanitizeCity(city);
          const saved = await publishBar({
            userId,
            barName,
            city: cleanCity,
            drinks: drinksRef.current,
          });
          setPublicBarsMap((prev) => ({
            ...prev,
            [saved.barKey]: saved,
          }));
          if (!existing) {
            onShowToast(`Shared "${saved.barName}" publicly!`);
          } else if (existing.city !== saved.city) {
            onShowToast(
              saved.city
                ? `Updated city for "${saved.barName}" to ${saved.city}.`
                : `Cleared city for "${saved.barName}".`
            );
          }
        } else if (existing) {
          await unpublishBar(userId, barKey);
          setPublicBarsMap((prev) => {
            const next = { ...prev };
            delete next[barKey];
            return next;
          });
          onShowToast(`"${barName}" is now private.`);
        }
      } catch (err) {
        onShowToast(
          err instanceof Error ? err.message : 'Could not update bar sharing settings.'
        );
      } finally {
        setUpdatingBarKey((prev) => (prev === barKey ? null : prev));
      }
    },
    [onShowToast]
  );

  const handleBarRenamed = useCallback(
    (oldName: string, newCanonicalName: string, nextDrinks: DrinkItem[]) => {
      const userId = sessionRef.current?.user?.id;
      if (!supabase || !userId) return;

      const oldKey = normalizeBarKey(oldName);
      const newKey = normalizeBarKey(newCanonicalName);
      const oldPub = mapRef.current[oldKey];
      const existingNewPub = mapRef.current[newKey];

      if (!oldPub && !existingNewPub) return;

      const preservedCity = existingNewPub?.city ?? oldPub?.city ?? null;

      void (async () => {
        try {
          if (oldPub && oldKey !== newKey) {
            await unpublishBar(userId, oldKey);
          }
          const saved = await publishBar({
            userId,
            barName: newCanonicalName,
            city: preservedCity,
            drinks: nextDrinks,
          });
          setPublicBarsMap((prev) => {
            const next = { ...prev };
            if (oldKey !== newKey) delete next[oldKey];
            next[saved.barKey] = saved;
            return next;
          });
        } catch {
          // Non-fatal; will sync on next edit
        }
      })();
    },
    []
  );

  const handleBarDeleted = useCallback((barName: string) => {
    const userId = sessionRef.current?.user?.id;
    if (!supabase || !userId) return;

    const barKey = normalizeBarKey(barName);
    if (!mapRef.current[barKey]) return;

    void unpublishBar(userId, barKey)
      .then(() => {
        setPublicBarsMap((prev) => {
          const next = { ...prev };
          delete next[barKey];
          return next;
        });
      })
      .catch(() => {});
  }, []);

  const shareState = useMemo(() => {
    const state: Record<string, BarShareInfo> = {};
    for (const [key, pub] of Object.entries(publicBarsMap)) {
      state[key] = { isPublic: true, city: pub.city };
    }
    return state;
  }, [publicBarsMap]);

  return {
    shareState,
    updatingBarKey,
    setBarPublic,
    handleBarRenamed,
    handleBarDeleted,
  };
}
