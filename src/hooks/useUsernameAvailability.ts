import { useEffect, useState } from 'react';
import {
  USERNAME_REGEX,
  checkUsernameAvailable,
  normalizeUsername,
} from '../utils/supabase';

export type UsernameAvailabilityStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'taken'
  | 'invalid'
  | 'same';

export function useUsernameAvailability(
  value: string,
  enabled: boolean,
  currentUsername?: string | null
): UsernameAvailabilityStatus {
  const [status, setStatus] = useState<UsernameAvailabilityStatus>('idle');

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      setStatus('idle');
      return;
    }

    const normalized = normalizeUsername(trimmed);
    if (!USERNAME_REGEX.test(normalized)) {
      setStatus('invalid');
      return;
    }

    if (currentUsername && normalizeUsername(currentUsername) === normalized) {
      setStatus('same');
      return;
    }

    let cancelled = false;
    setStatus('checking');
    const timer = setTimeout(async () => {
      const available = await checkUsernameAvailable(normalized);
      if (cancelled) return;
      if (available === true) setStatus('available');
      else if (available === false) setStatus('taken');
      else setStatus('idle');
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, enabled, currentUsername]);

  return status;
}
