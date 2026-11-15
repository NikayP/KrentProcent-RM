import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  changeUsername,
  normalizeUsername,
  validateUsername,
} from '../../utils/supabase';
import { useUsernameAvailability } from '../../hooks/useUsernameAvailability';

interface ChangeUsernameFormProps {
  currentUsername: string | null;
  disabled: boolean;
  onSubmittingChange: (submitting: boolean) => void;
  onError: (msg: string | null) => void;
  onSuccess: (updatedUsername: string) => void;
  onCancel: () => void;
}

export const ChangeUsernameForm: React.FC<ChangeUsernameFormProps> = ({
  currentUsername,
  disabled,
  onSubmittingChange,
  onError,
  onSuccess,
  onCancel,
}) => {
  const [nextUsername, setNextUsername] = useState(currentUsername || '');
  const [isSaving, setIsSaving] = useState(false);

  const availability = useUsernameAvailability(nextUsername, true, currentUsername);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);

    const err = validateUsername(nextUsername);
    if (err) {
      onError(err);
      return;
    }

    const normalized = normalizeUsername(nextUsername);
    if (currentUsername && normalizeUsername(currentUsername) === normalized) {
      onError('That is already your current username.');
      return;
    }

    setIsSaving(true);
    onSubmittingChange(true);
    try {
      const updated = await changeUsername(normalized);
      onSuccess(updated);
    } catch (e2) {
      onError(e2 instanceof Error ? e2.message : 'Could not update username.');
    } finally {
      setIsSaving(false);
      onSubmittingChange(false);
    }
  };

  const canSubmit =
    !disabled &&
    !isSaving &&
    availability !== 'taken' &&
    availability !== 'invalid' &&
    availability !== 'same' &&
    nextUsername.trim().length >= 3;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl bg-[#FFF2F3]/60 dark:bg-[#121214] border border-[#E4E4E7] dark:border-[#27272A] p-3.5 space-y-2.5"
    >
      <div>
        <label
          htmlFor="account-new-username"
          className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
        >
          New username
        </label>
        <input
          id="account-new-username"
          type="text"
          autoComplete="username"
          value={nextUsername}
          onChange={(e) => setNextUsername(e.target.value)}
          placeholder="e.g. jan.kroeg"
          required
          minLength={3}
          maxLength={24}
          autoFocus
          className="w-full bg-[#FFFFFF] dark:bg-[#18181B] text-[#18181B] dark:text-white text-sm rounded-xl px-3 py-2 border border-[#E4E4E7] dark:border-[#27272A] focus:outline-none focus:border-[#F21B2D]"
        />
        <div className="flex items-center justify-between gap-2 mt-1 text-[11px]">
          <span className="text-zinc-500 dark:text-zinc-400">
            3–24 chars: letters, numbers, . _ -
          </span>
          {availability === 'checking' && <span className="text-zinc-400">Checking…</span>}
          {availability === 'available' && (
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Available</span>
          )}
          {availability === 'taken' && (
            <span className="text-[#D91424] dark:text-[#FF8A8E] font-semibold">
              Already taken
            </span>
          )}
          {availability === 'invalid' && (
            <span className="text-[#D91424] dark:text-[#FF8A8E] font-semibold">
              Invalid format
            </span>
          )}
          {availability === 'same' && (
            <span className="text-zinc-400">Current username</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex-1 py-2 px-3 rounded-xl bg-[#F21B2D] hover:bg-[#D91424] disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
        >
          {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <span>Save username</span>
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
