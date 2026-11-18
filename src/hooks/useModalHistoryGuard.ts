import { useEffect, useRef } from 'react';

/**
 * Pushes a synthetic history entry whenever a modal is open so the Android/browser
 * back gesture closes the topmost modal instead of leaving the app.
 */
export function useModalHistoryGuard(anyModalOpen: boolean, onBackClose: () => void) {
  const pushedModalHistoryRef = useRef(false);
  const closingFromPopstateRef = useRef(false);
  const onBackCloseRef = useRef(onBackClose);
  onBackCloseRef.current = onBackClose;

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
      onBackCloseRef.current();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
}
