import { useCallback, useEffect, useRef, useState } from 'react';

export function useToast() {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const showToast = useCallback((msg: string, duration = 3200) => {
    setToastMessage(msg);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setToastMessage(null);
    }, duration);
  }, []);

  return { toastMessage, showToast };
}
