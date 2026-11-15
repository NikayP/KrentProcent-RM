import React, { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AtSign, KeyRound, LogOut, Trash2 } from 'lucide-react';
import type { SyncStatus } from '../../types/account';
import { SyncBadge } from './SyncBadge';
import { PrivacyNote } from './PrivacyNote';
import { ChangeUsernameForm } from './ChangeUsernameForm';
import { ChangePasswordForm } from './ChangePasswordForm';

interface LoggedInViewProps {
  session: Session;
  username: string | null;
  displayName: string;
  syncStatus: SyncStatus;
  isSubmitting: boolean;
  onSubmittingChange: (submitting: boolean) => void;
  onError: (msg: string | null) => void;
  onInfo: (msg: string | null) => void;
  onUsernameChanged: (newUsername: string) => void;
  onShowToast: (msg: string) => void;
  onLogout: () => void;
  onRequestDeleteAccount: () => void;
}

export const LoggedInView: React.FC<LoggedInViewProps> = ({
  session,
  username,
  displayName,
  syncStatus,
  isSubmitting,
  onSubmittingChange,
  onError,
  onInfo,
  onUsernameChanged,
  onShowToast,
  onLogout,
  onRequestDeleteAccount,
}) => {
  const [activeEditor, setActiveEditor] = useState<'none' | 'username' | 'password'>('none');

  const toggleEditor = (next: 'username' | 'password') => {
    onError(null);
    onInfo(null);
    setActiveEditor((prev) => (prev === next ? 'none' : next));
  };

  return (
    <div className="space-y-3.5">
      <div className="rounded-xl bg-[#FFF2F3]/70 dark:bg-[#121214] border border-[#E4E4E7] dark:border-[#27272A] p-3.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Logged in as</div>
            <div className="text-sm font-bold text-[#18181B] dark:text-white truncate">
              {displayName}
            </div>
            {session.user.email && displayName !== session.user.email && (
              <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                {session.user.email}
              </div>
            )}
          </div>

          <div className="shrink-0">
            <SyncBadge syncStatus={syncStatus} />
          </div>
        </div>

        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {syncStatus === 'offline'
            ? 'Changes are saved on this device and will sync automatically when you are back online.'
            : 'Your scanned bars and drinks stay backed up automatically.'}
        </p>
      </div>

      {/* Collapsible Edit Triggers */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => toggleEditor('username')}
          className={`flex-1 min-w-[140px] py-2 px-3 rounded-xl text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5 ${
            activeEditor === 'username'
              ? 'bg-[#F21B2D]/10 text-[#D91424] dark:text-[#FF8A8E] border-[#F21B2D]/40'
              : 'bg-[#FFFFFF] dark:bg-[#121214] text-[#18181B] dark:text-zinc-200 border-[#E4E4E7] dark:border-[#27272A] hover:bg-[#FFF2F3] dark:hover:bg-[#27272A]'
          }`}
        >
          <AtSign className="w-3.5 h-3.5" />
          <span>Change username</span>
        </button>

        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => toggleEditor('password')}
          className={`flex-1 min-w-[140px] py-2 px-3 rounded-xl text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5 ${
            activeEditor === 'password'
              ? 'bg-[#F21B2D]/10 text-[#D91424] dark:text-[#FF8A8E] border-[#F21B2D]/40'
              : 'bg-[#FFFFFF] dark:bg-[#121214] text-[#18181B] dark:text-zinc-200 border-[#E4E4E7] dark:border-[#27272A] hover:bg-[#FFF2F3] dark:hover:bg-[#27272A]'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Change password</span>
        </button>
      </div>

      {activeEditor === 'username' && (
        <ChangeUsernameForm
          currentUsername={username}
          disabled={isSubmitting}
          onSubmittingChange={onSubmittingChange}
          onError={onError}
          onSuccess={(updated) => {
            onUsernameChanged(updated);
            setActiveEditor('none');
            onInfo(`Username updated to @${updated}.`);
            onShowToast(`Username changed to @${updated}.`);
          }}
          onCancel={() => {
            onError(null);
            setActiveEditor('none');
          }}
        />
      )}

      {activeEditor === 'password' && (
        <ChangePasswordForm
          disabled={isSubmitting}
          onSubmittingChange={onSubmittingChange}
          onError={onError}
          onSuccess={() => {
            setActiveEditor('none');
            onInfo('Password updated!');
            onShowToast('Password updated!');
          }}
          onCancel={() => {
            onError(null);
            setActiveEditor('none');
          }}
        />
      )}

      <PrivacyNote />

      <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
        <button
          type="button"
          onClick={onLogout}
          disabled={isSubmitting}
          className="flex-1 py-2 px-4 rounded-xl text-xs sm:text-sm font-semibold text-[#18181B] dark:text-zinc-200 bg-[#FFF2F3] dark:bg-[#121214] hover:bg-zinc-100 dark:hover:bg-[#27272A] border border-[#E4E4E7] dark:border-[#27272A] transition-colors flex items-center justify-center gap-1.5"
        >
          <LogOut className="w-4 h-4" />
          <span>Log out</span>
        </button>

        <button
          type="button"
          onClick={onRequestDeleteAccount}
          disabled={isSubmitting}
          className="py-2 px-4 rounded-xl text-xs sm:text-sm font-semibold text-[#D91424] dark:text-[#FF8A8E] hover:bg-[#F21B2D]/10 border border-[#F21B2D]/30 transition-colors flex items-center justify-center gap-1.5"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete account</span>
        </button>
      </div>
    </div>
  );
};
