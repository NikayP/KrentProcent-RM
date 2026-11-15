import React, { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  User,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  KeyRound,
  AlertCircle,
  Cloud,
  Globe,
  Smartphone,
} from 'lucide-react';
import {
  logInWithIdentifier,
  logOut,
  requestPasswordReset,
  signUpWithUsername,
  updatePassword,
  validatePassword,
  validateUsername,
} from '../../utils/supabase';
import { useUsernameAvailability } from '../../hooks/useUsernameAvailability';
import type { SyncStatus } from '../../types/account';
import { LoggedInView } from './LoggedInView';
import { PrivacyNote } from './PrivacyNote';

type AuthView = 'login' | 'register' | 'forgot';

export interface AccountPanelProps {
  session: Session | null;
  username: string | null;
  syncStatus: SyncStatus;
  isRecovery: boolean;
  onRecoveryComplete: () => void;
  onBeforeAuth: (mode: 'login' | 'register') => void;
  onAuthErrorReset: () => void;
  onRequestDeleteAccount: () => void;
  onUsernameChanged: (newUsername: string) => void;
  onShowToast: (msg: string) => void;
  localDrinkCount: number;
  barCount?: number;
  publicBarCount?: number;
  onGoToMyBars?: () => void;
  onGoToDiscover?: () => void;
  onClose?: () => void;
  onSubmittingChange?: (submitting: boolean) => void;
  titleId?: string;
}

export const AccountPanel: React.FC<AccountPanelProps> = ({
  session,
  username,
  syncStatus,
  isRecovery,
  onRecoveryComplete,
  onBeforeAuth,
  onAuthErrorReset,
  onRequestDeleteAccount,
  onUsernameChanged,
  onShowToast,
  localDrinkCount,
  barCount = 0,
  publicBarCount = 0,
  onGoToMyBars,
  onGoToDiscover,
  onClose,
  onSubmittingChange,
  titleId = 'account-panel-title',
}) => {
  const [view, setView] = useState<AuthView>('login');
  const [identifier, setIdentifier] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const updateSubmitting = (next: boolean) => {
    setIsSubmitting(next);
    onSubmittingChange?.(next);
  };

  const usernameStatus = useUsernameAvailability(
    regUsername,
    !isRecovery && !session && view === 'register'
  );

  const switchView = (nextView: AuthView) => {
    setView(nextView);
    setErrorMsg(null);
    setInfoMsg(null);
    setPassword('');
    setShowPassword(false);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!identifier.trim() || !password) {
      setErrorMsg('Please enter your username or email and password.');
      return;
    }

    updateSubmitting(true);
    onBeforeAuth('login');
    try {
      await logInWithIdentifier(identifier, password);
      setPassword('');
      onShowToast('Logged in! Syncing your scans...');
      onClose?.();
    } catch (err) {
      onAuthErrorReset();
      setErrorMsg(err instanceof Error ? err.message : 'Could not log in.');
    } finally {
      updateSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const uErr = validateUsername(regUsername);
    if (uErr) {
      setErrorMsg(uErr);
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    const pErr = validatePassword(password);
    if (pErr) {
      setErrorMsg(pErr);
      return;
    }

    updateSubmitting(true);
    onBeforeAuth('register');
    try {
      const result = await signUpWithUsername({
        username: regUsername,
        email,
        password,
      });
      setPassword('');

      if (result.needsEmailConfirmation) {
        onAuthErrorReset();
        setInfoMsg('Check your inbox to confirm your account, then log in.');
      } else {
        onShowToast('Account created! Your scans are saved.');
        onClose?.();
      }
    } catch (err) {
      onAuthErrorReset();
      setErrorMsg(err instanceof Error ? err.message : 'Could not create account.');
    } finally {
      updateSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    updateSubmitting(true);
    try {
      await requestPasswordReset(email);
      setInfoMsg("If this email has an account, we've sent a reset link.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not send reset link.');
    } finally {
      updateSubmitting(false);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const pErr = validatePassword(password);
    if (pErr) {
      setErrorMsg(pErr);
      return;
    }

    updateSubmitting(true);
    try {
      await updatePassword(password);
      setPassword('');
      onRecoveryComplete();
      onShowToast('Password updated!');
      onClose?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not update password.');
    } finally {
      updateSubmitting(false);
    }
  };

  const handleLogoutClick = async () => {
    updateSubmitting(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      await logOut();
      onShowToast('Logged out. Your drinks stay saved on this device.');
      onClose?.();
    } catch {
      setErrorMsg('Could not log out. Please try again.');
    } finally {
      updateSubmitting(false);
    }
  };

  const displayName =
    username ||
    (typeof session?.user?.user_metadata?.username === 'string'
      ? session.user.user_metadata.username
      : null) ||
    session?.user?.email ||
    'Account';

  const feedbackBanner = (errorMsg || infoMsg) && (
    <div aria-live="polite" className="space-y-2">
      {errorMsg && (
        <div className="flex items-start gap-2 rounded-xl border border-[#F21B2D]/40 bg-[#F21B2D]/10 px-3 py-2.5 text-xs text-[#D91424] dark:text-[#FF8A8E] font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
      {infoMsg && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
          <Mail className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{infoMsg}</span>
        </div>
      )}
    </div>
  );

  // VIEW 1: PASSWORD RECOVERY
  if (isRecovery) {
    return (
      <div className="max-w-lg bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[#F21B2D]/15 text-[#F21B2D] border border-[#F21B2D]/30">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3
              id={titleId}
              className="text-base sm:text-lg font-extrabold tracking-[-0.02em] text-[#18181B] dark:text-[#FFFFFF]"
            >
              Choose New Password
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Set a new password for your KrentProcent account.
            </p>
          </div>
        </div>

        {feedbackBanner}

        <form onSubmit={handleRecoverySubmit} className="space-y-3.5">
          <div>
            <label
              htmlFor="account-recovery-password"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
            >
              New password
            </label>
            <div className="relative">
              <input
                id="account-recovery-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
                maxLength={200}
                className="w-full bg-[#FAFAFA] dark:bg-[#121214] text-[#18181B] dark:text-white text-sm rounded-xl pl-3 pr-10 py-2 border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-[#18181B] dark:hover:text-white p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
              At least 8 characters.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-xl bg-[#F21B2D] hover:bg-[#D91424] disabled:opacity-60 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Save new password</span>
          </button>
        </form>
      </div>
    );
  }

  // VIEW 2: LOGGED IN — Full Account Management Hub
  if (session) {
    return (
      <div className="space-y-4">
        {feedbackBanner}
        <LoggedInView
          session={session}
          username={username}
          displayName={displayName}
          syncStatus={syncStatus}
          localDrinkCount={localDrinkCount}
          barCount={barCount}
          publicBarCount={publicBarCount}
          isSubmitting={isSubmitting}
          onSubmittingChange={updateSubmitting}
          onError={(msg) => {
            setErrorMsg(msg);
            if (msg) setInfoMsg(null);
          }}
          onInfo={(msg) => {
            setInfoMsg(msg);
            if (msg) setErrorMsg(null);
          }}
          onUsernameChanged={onUsernameChanged}
          onShowToast={onShowToast}
          onLogout={handleLogoutClick}
          onRequestDeleteAccount={() => {
            onClose?.();
            onRequestDeleteAccount();
          }}
          onGoToMyBars={onGoToMyBars}
          onGoToDiscover={onGoToDiscover}
          titleId={titleId}
        />
      </div>
    );
  }

  // VIEW 3: LOGGED OUT — 2-column Auth + Benefits layout
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <div className="lg:col-span-7 bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[#F21B2D]/15 text-[#F21B2D] border border-[#F21B2D]/30">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3
                id={titleId}
                className="text-base sm:text-lg font-extrabold tracking-[-0.02em] text-[#18181B] dark:text-[#FFFFFF]"
              >
                {view === 'register'
                  ? 'Create Account'
                  : view === 'forgot'
                    ? 'Reset Password'
                    : 'Log In'}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Save your scanned menus and share bars when you want.
              </p>
            </div>
          </div>

          {view !== 'forgot' && (
            <div className="inline-flex p-1 rounded-xl bg-[#FAFAFA] dark:bg-[#121214] border border-[#E4E4E7] dark:border-[#27272A] self-start sm:self-auto">
              <button
                type="button"
                onClick={() => switchView('login')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  view === 'login'
                    ? 'bg-[#F21B2D] text-white'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-[#18181B] dark:hover:text-white'
                }`}
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => switchView('register')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  view === 'register'
                    ? 'bg-[#F21B2D] text-white'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-[#18181B] dark:hover:text-white'
                }`}
              >
                Create account
              </button>
            </div>
          )}
        </div>

        {feedbackBanner}

        {view === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-3.5">
            <div>
              <label
                htmlFor="account-identifier"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Username or email
              </label>
              <input
                id="account-identifier"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="username or you@example.com"
                required
                className="w-full bg-[#FAFAFA] dark:bg-[#121214] text-[#18181B] dark:text-white text-sm rounded-xl px-3 py-2 border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D]"
              />
            </div>

            <div>
              <label
                htmlFor="account-password"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="account-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  required
                  className="w-full bg-[#FAFAFA] dark:bg-[#121214] text-[#18181B] dark:text-white text-sm rounded-xl pl-3 pr-10 py-2 border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-[#18181B] dark:hover:text-white p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => switchView('forgot')}
                className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-[#18181B] dark:hover:text-white hover:underline cursor-pointer"
              >
                Forgot password?
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-[#F21B2D] hover:bg-[#D91424] disabled:opacity-60 text-white font-bold text-sm transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Log in</span>
              </button>
            </div>
          </form>
        )}

        {view === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            {localDrinkCount > 0 && (
              <p className="text-[11px] text-zinc-600 dark:text-zinc-300 bg-[#FFF2F3] dark:bg-[#121214] border border-[#E4E4E7] dark:border-[#27272A] rounded-xl px-3 py-2">
                Your {localDrinkCount} drink{localDrinkCount === 1 ? '' : 's'} on this device will
                be backed up to your new account.
              </p>
            )}

            <div>
              <label
                htmlFor="account-reg-username"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Username
              </label>
              <input
                id="account-reg-username"
                type="text"
                autoComplete="username"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                placeholder="e.g. jan.kroeg"
                required
                minLength={3}
                maxLength={24}
                className="w-full bg-[#FAFAFA] dark:bg-[#121214] text-[#18181B] dark:text-white text-sm rounded-xl px-3 py-2 border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D]"
              />
              <div className="flex items-center justify-between gap-2 mt-1 text-[11px]">
                <span className="text-zinc-500 dark:text-zinc-400">
                  3–24 characters: letters, numbers, . _ -
                </span>
                {usernameStatus === 'checking' && (
                  <span className="text-zinc-400">Checking…</span>
                )}
                {usernameStatus === 'available' && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    Available
                  </span>
                )}
                {usernameStatus === 'taken' && (
                  <span className="text-[#D91424] dark:text-[#FF8A8E] font-semibold">
                    Already taken
                  </span>
                )}
                {usernameStatus === 'invalid' && (
                  <span className="text-[#D91424] dark:text-[#FF8A8E] font-semibold">
                    Invalid format
                  </span>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="account-reg-email"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Email
              </label>
              <input
                id="account-reg-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-[#FAFAFA] dark:bg-[#121214] text-[#18181B] dark:text-white text-sm rounded-xl px-3 py-2 border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D]"
              />
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                Only used if you need to reset your password.
              </p>
            </div>

            <div>
              <label
                htmlFor="account-reg-password"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="account-reg-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  maxLength={200}
                  className="w-full bg-[#FAFAFA] dark:bg-[#121214] text-[#18181B] dark:text-white text-sm rounded-xl pl-3 pr-10 py-2 border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-[#18181B] dark:hover:text-white p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                At least 8 characters.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || usernameStatus === 'taken'}
              className="w-full py-2.5 px-4 rounded-xl bg-[#F21B2D] hover:bg-[#D91424] disabled:opacity-60 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Create account</span>
            </button>
          </form>
        )}

        {view === 'forgot' && (
          <form onSubmit={handleForgotSubmit} className="space-y-3.5">
            <div>
              <label
                htmlFor="account-forgot-email"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Email
              </label>
              <input
                id="account-forgot-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-[#FAFAFA] dark:bg-[#121214] text-[#18181B] dark:text-white text-sm rounded-xl px-3 py-2 border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D]"
              />
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                We&apos;ll send a link to set a new password.
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => switchView('login')}
                className="text-xs font-semibold text-[#F21B2D] hover:underline cursor-pointer"
              >
                Back to log in
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-[#F21B2D] hover:bg-[#D91424] disabled:opacity-60 text-white font-bold text-sm transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Send reset link</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Right Column: Account Benefits & Privacy */}
      <aside className="lg:col-span-5 bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <h4 className="text-sm font-bold text-[#18181B] dark:text-white">
          Why create an account?
        </h4>

        <ul className="space-y-3 text-xs text-zinc-600 dark:text-zinc-300">
          <li className="flex items-start gap-2.5">
            <Cloud className="w-4 h-4 text-[#F21B2D] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[#18181B] dark:text-white block">
                Automatic cloud backup
              </span>
              Keep your bars and scanned menus in sync between phone and laptop.
            </div>
          </li>
          <li className="flex items-start gap-2.5">
            <Globe className="w-4 h-4 text-[#F21B2D] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[#18181B] dark:text-white block">
                Share menus in Discover
              </span>
              Opt in to publish any bar under your @username so friends can adopt it in one tap.
            </div>
          </li>
          <li className="flex items-start gap-2.5">
            <Smartphone className="w-4 h-4 text-[#F21B2D] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[#18181B] dark:text-white block">
                100% optional &amp; offline-ready
              </span>
              Everything stays saved locally on this device even if you stay logged out.
            </div>
          </li>
        </ul>

        <PrivacyNote />
      </aside>
    </div>
  );
};
