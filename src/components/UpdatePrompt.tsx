import React, { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export const UpdatePrompt: React.FC = () => {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, reg) {
      if (reg) setRegistration(reg);
    },
  });

  useEffect(() => {
    if (!registration) return;
    // Check for app updates when returning to the app
    const checkUpdate = () => {
      if (document.visibilityState === 'visible') {
        void registration.update();
      }
    };
    document.addEventListener('visibilitychange', checkUpdate);
    return () => {
      document.removeEventListener('visibilitychange', checkUpdate);
    };
  }, [registration]);

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] sm:bottom-5 right-4 left-4 sm:left-auto z-50 sm:max-w-sm"
    >
      <div className="bg-[#FFFFFF] dark:bg-[#18181B] border border-[#F21B2D]/40 text-[#18181B] dark:text-[#FFFFFF] rounded-2xl px-4 py-3 shadow-xl flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-[#18181B] dark:text-white">
            Update available
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
            Reload to get the latest version.
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => void updateServiceWorker(true)}
            className="px-3 py-1.5 rounded-xl bg-[#F21B2D] hover:bg-[#D91424] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload</span>
          </button>
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            aria-label="Dismiss update notification"
            className="p-1.5 rounded-xl text-zinc-400 hover:text-[#18181B] dark:hover:text-white hover:bg-[#FFF2F3] dark:hover:bg-[#27272A] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
