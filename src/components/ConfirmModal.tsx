import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl p-5 sm:p-6 shadow-2xl relative space-y-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-zinc-400 hover:text-[#18181B] dark:hover:text-white hover:bg-[#FFF2F3] dark:hover:bg-[#27272A] transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon + Title */}
        <div className="flex items-start gap-3.5">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              variant === 'danger'
                ? 'bg-[#F21B2D]/15 text-[#F21B2D] border border-[#F21B2D]/30'
                : 'bg-[#FF8A8E]/20 text-[#D91424] dark:text-[#FF8A8E] border border-[#FF8A8E]/40'
            }`}
          >
            {variant === 'danger' ? (
              <Trash2 className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>

          <div className="pr-6">
            <h3 id="confirm-modal-title" className="text-base sm:text-lg font-bold text-[#18181B] dark:text-[#FFFFFF]">
              {title}
            </h3>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E4E4E7] dark:border-[#27272A]">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-[#18181B] dark:text-zinc-300 hover:text-[#18181B] dark:hover:text-white bg-[#FFF2F3] dark:bg-[#121214] hover:bg-zinc-100 dark:hover:bg-[#27272A] border border-[#E4E4E7] dark:border-[#27272A] transition-colors"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all flex items-center gap-1.5 bg-[#F21B2D] hover:bg-[#D91424] text-white"
          >
            <Trash2 className="w-4 h-4" />
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
