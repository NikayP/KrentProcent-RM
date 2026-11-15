import React, { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { changePassword, validatePassword } from '../../utils/supabase';

interface ChangePasswordFormProps {
  disabled: boolean;
  onSubmittingChange: (submitting: boolean) => void;
  onError: (msg: string | null) => void;
  onSuccess: () => void;
  onCancel: () => void;
}

export const ChangePasswordForm: React.FC<ChangePasswordFormProps> = ({
  disabled,
  onSubmittingChange,
  onError,
  onSuccess,
  onCancel,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);

    if (!currentPassword) {
      onError('Please enter your current password.');
      return;
    }

    const pErr = validatePassword(newPassword);
    if (pErr) {
      onError(pErr);
      return;
    }

    setIsSaving(true);
    onSubmittingChange(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not update password.');
    } finally {
      setIsSaving(false);
      onSubmittingChange(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl bg-[#FFF2F3]/60 dark:bg-[#121214] border border-[#E4E4E7] dark:border-[#27272A] p-3.5 space-y-2.5"
    >
      <div>
        <label
          htmlFor="account-current-password"
          className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
        >
          Current password
        </label>
        <div className="relative">
          <input
            id="account-current-password"
            type={showCurrent ? 'text' : 'password'}
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Your current password"
            required
            autoFocus
            className="w-full bg-[#FFFFFF] dark:bg-[#18181B] text-[#18181B] dark:text-white text-sm rounded-xl pl-3 pr-10 py-2 border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D]"
          />
          <button
            type="button"
            onClick={() => setShowCurrent((prev) => !prev)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-[#18181B] dark:hover:text-white p-1"
            aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
          >
            {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div>
        <label
          htmlFor="account-change-new-password"
          className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
        >
          New password
        </label>
        <div className="relative">
          <input
            id="account-change-new-password"
            type={showNew ? 'text' : 'password'}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
            required
            minLength={8}
            maxLength={200}
            className="w-full bg-[#FFFFFF] dark:bg-[#18181B] text-[#18181B] dark:text-white text-sm rounded-xl pl-3 pr-10 py-2 border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D]"
          />
          <button
            type="button"
            onClick={() => setShowNew((prev) => !prev)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-[#18181B] dark:hover:text-white p-1"
            aria-label={showNew ? 'Hide new password' : 'Show new password'}
          >
            {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="submit"
          disabled={disabled || isSaving}
          className="flex-1 py-2 px-3 rounded-xl bg-[#F21B2D] hover:bg-[#D91424] disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
        >
          {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <span>Update password</span>
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="py-2 px-3 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 bg-[#FFFFFF] dark:bg-[#18181B] hover:bg-zinc-100 dark:hover:bg-[#27272A] border border-[#E4E4E7] dark:border-[#27272A]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};
