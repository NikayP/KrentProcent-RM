import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { SyncStatus } from '../types/account';
import { AccountPanel, type AccountPanelProps } from './account/AccountPanel';

export type { SyncStatus };

interface AccountModalProps extends Omit<AccountPanelProps, 'onSubmittingChange' | 'titleId'> {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  ...panelProps
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => !isSubmitting && onClose()}
    >
      <div
        className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl p-5 sm:p-6 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-modal-title"
      >
        <button
          type="button"
          onClick={() => !isSubmitting && onClose()}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-zinc-400 hover:text-[#18181B] dark:hover:text-white hover:bg-[#FFF2F3] dark:hover:bg-[#27272A] transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <AccountPanel
          {...panelProps}
          onClose={onClose}
          onSubmittingChange={setIsSubmitting}
          titleId="account-modal-title"
        />
      </div>
    </div>
  );
};
