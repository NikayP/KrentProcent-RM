import React, { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  AtSign,
  KeyRound,
  LogOut,
  Trash2,
  UserCheck,
  Store,
  Compass,
  ArrowRight,
  Beer,
  Globe,
} from 'lucide-react';
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
  localDrinkCount: number;
  barCount: number;
  publicBarCount: number;
  isSubmitting: boolean;
  onSubmittingChange: (submitting: boolean) => void;
  onError: (msg: string | null) => void;
  onInfo: (msg: string | null) => void;
  onUsernameChanged: (newUsername: string) => void;
  onShowToast: (msg: string) => void;
  onLogout: () => void;
  onRequestDeleteAccount: () => void;
  onGoToMyBars?: () => void;
  onGoToDiscover?: () => void;
  titleId?: string;
}

export const LoggedInView: React.FC<LoggedInViewProps> = ({
  session,
  username,
  displayName,
  syncStatus,
  localDrinkCount,
  barCount,
  publicBarCount,
  isSubmitting,
  onSubmittingChange,
  onError,
  onInfo,
  onUsernameChanged,
  onShowToast,
  onLogout,
  onRequestDeleteAccount,
  onGoToMyBars,
  onGoToDiscover,
  titleId = 'account-panel-title',
}) => {
  const [activeEditor, setActiveEditor] = useState<'none' | 'username' | 'password'>('none');

  const toggleEditor = (next: 'username' | 'password') => {
    onError(null);
    onInfo(null);
    setActiveEditor((prev) => (prev === next ? 'none' : next));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left column: Identity, Stats & Security Controls */}
      <div className="lg:col-span-7 space-y-5">
        {/* Profile & Cloud Sync Card */}
        <section className="bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 bg-[#F21B2D]/15 text-[#F21B2D] border border-[#F21B2D]/30">
                <UserCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3
                    id={titleId}
                    className="text-base sm:text-lg font-extrabold tracking-[-0.02em] text-[#18181B] dark:text-[#FFFFFF] truncate"
                  >
                    {username ? `@${username}` : displayName}
                  </h3>
                </div>
                {session.user.email && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    {session.user.email}
                  </p>
                )}
              </div>
            </div>

            <div className="shrink-0">
              <SyncBadge syncStatus={syncStatus} />
            </div>
          </div>

          {/* Live Account Summary Stats */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-xl bg-[#FAFAFA] dark:bg-[#121214] border border-[#E4E4E7] dark:border-[#27272A] p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                <Beer className="w-3.5 h-3.5 text-[#F21B2D]" />
                <span>Drinks</span>
              </div>
              <div className="mt-1 text-lg font-extrabold tabular-nums text-[#18181B] dark:text-white">
                {localDrinkCount}
              </div>
            </div>

            <button
              type="button"
              onClick={onGoToMyBars}
              className="text-left rounded-xl bg-[#FAFAFA] dark:bg-[#121214] hover:bg-[#FFF2F3] dark:hover:bg-[#27272A]/60 border border-[#E4E4E7] dark:border-[#27272A] p-3 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                <Store className="w-3.5 h-3.5 text-[#F21B2D]" />
                <span>My Bars</span>
              </div>
              <div className="mt-1 text-lg font-extrabold tabular-nums text-[#18181B] dark:text-white">
                {barCount}
              </div>
            </button>

            <button
              type="button"
              onClick={onGoToMyBars}
              className="text-left rounded-xl bg-[#FAFAFA] dark:bg-[#121214] hover:bg-[#FFF2F3] dark:hover:bg-[#27272A]/60 border border-[#E4E4E7] dark:border-[#27272A] p-3 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                <Globe className="w-3.5 h-3.5 text-emerald-500" />
                <span>Public</span>
              </div>
              <div className="mt-1 text-lg font-extrabold tabular-nums text-[#18181B] dark:text-white">
                {publicBarCount}
              </div>
            </button>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {syncStatus === 'offline'
              ? 'Changes are saved on this device and will sync automatically when you are back online.'
              : 'Your bars, drinks, and scanned menus are backed up automatically across devices.'}
          </p>
        </section>

        {/* Profile & Security Settings Card */}
        <section className="bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div>
            <h4 className="text-sm font-bold text-[#18181B] dark:text-white">
              Profile &amp; Security
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Update how you appear on shared bars or change your password.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => toggleEditor('username')}
              className={`flex-1 py-2.5 px-3.5 rounded-xl text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                activeEditor === 'username'
                  ? 'bg-[#F21B2D]/10 text-[#D91424] dark:text-[#FF8A8E] border-[#F21B2D]/40'
                  : 'bg-[#FAFAFA] dark:bg-[#121214] text-[#18181B] dark:text-zinc-200 border-[#E4E4E7] dark:border-[#27272A] hover:bg-[#FFF2F3] dark:hover:bg-[#27272A]'
              }`}
            >
              <AtSign className="w-3.5 h-3.5" />
              <span>Change username</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => toggleEditor('password')}
              className={`flex-1 py-2.5 px-3.5 rounded-xl text-xs font-semibold border transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                activeEditor === 'password'
                  ? 'bg-[#F21B2D]/10 text-[#D91424] dark:text-[#FF8A8E] border-[#F21B2D]/40'
                  : 'bg-[#FAFAFA] dark:bg-[#121214] text-[#18181B] dark:text-zinc-200 border-[#E4E4E7] dark:border-[#27272A] hover:bg-[#FFF2F3] dark:hover:bg-[#27272A]'
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
        </section>
      </div>

      {/* Right column: Privacy, Shortcuts & Session */}
      <div className="lg:col-span-5 space-y-5">
        <section className="bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl p-5 sm:p-6 shadow-sm space-y-3.5">
          <h4 className="text-sm font-bold text-[#18181B] dark:text-white">
            Sharing &amp; Privacy
          </h4>

          <PrivacyNote />

          {(onGoToMyBars || onGoToDiscover) && (
            <div className="flex flex-col gap-2 pt-1">
              {onGoToMyBars && (
                <button
                  type="button"
                  onClick={onGoToMyBars}
                  className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-[#18181B] dark:text-zinc-200 bg-[#FAFAFA] dark:bg-[#121214] hover:bg-[#FFF2F3] dark:hover:bg-[#27272A] border border-[#E4E4E7] dark:border-[#27272A] transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Store className="w-3.5 h-3.5 text-[#F21B2D]" />
                    Manage public bars in My Bars
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                </button>
              )}
              {onGoToDiscover && (
                <button
                  type="button"
                  onClick={onGoToDiscover}
                  className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-[#18181B] dark:text-zinc-200 bg-[#FAFAFA] dark:bg-[#121214] hover:bg-[#FFF2F3] dark:hover:bg-[#27272A] border border-[#E4E4E7] dark:border-[#27272A] transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Compass className="w-3.5 h-3.5 text-[#F21B2D]" />
                    Browse Community Bars
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                </button>
              )}
            </div>
          )}
        </section>

        <section className="bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl p-5 sm:p-6 shadow-sm space-y-3">
          <button
            type="button"
            onClick={onLogout}
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold text-[#18181B] dark:text-zinc-200 bg-[#FAFAFA] dark:bg-[#121214] hover:bg-zinc-100 dark:hover:bg-[#27272A] border border-[#E4E4E7] dark:border-[#27272A] transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Log out</span>
          </button>

          <div className="pt-3 border-t border-[#E4E4E7] dark:border-[#27272A] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Delete account
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Removes cloud data; local drinks remain on this device.
              </p>
            </div>
            <button
              type="button"
              onClick={onRequestDeleteAccount}
              disabled={isSubmitting}
              className="shrink-0 py-1.5 px-3 rounded-xl text-xs font-semibold text-[#D91424] dark:text-[#FF8A8E] hover:bg-[#F21B2D]/10 border border-[#F21B2D]/30 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
