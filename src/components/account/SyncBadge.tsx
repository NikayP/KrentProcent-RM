import React from 'react';
import { Check, CloudOff, Loader2 } from 'lucide-react';
import type { SyncStatus } from '../../types/account';

interface SyncBadgeProps {
  syncStatus: SyncStatus;
}

export const SyncBadge: React.FC<SyncBadgeProps> = ({ syncStatus }) => {
  if (syncStatus === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-[#27272A] text-zinc-600 dark:text-zinc-300">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Saving…
      </span>
    );
  }
  if (syncStatus === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
        <Check className="w-3.5 h-3.5" />
        Saved
      </span>
    );
  }
  if (syncStatus === 'offline') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
        <CloudOff className="w-3.5 h-3.5" />
        Offline
      </span>
    );
  }
  return null;
};
