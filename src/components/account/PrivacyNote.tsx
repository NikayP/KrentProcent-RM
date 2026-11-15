import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const PrivacyNote: React.FC = () => (
  <div className="flex items-start gap-2 rounded-xl bg-[#FFF2F3]/50 dark:bg-[#121214] border border-[#E4E4E7] dark:border-[#27272A] px-3 py-2 text-[11px] text-zinc-500 dark:text-zinc-400">
    <ShieldCheck className="w-3.5 h-3.5 text-[#F21B2D] shrink-0 mt-0.5" />
    <span>
      We only store your username, email (for password reset), and saved menus. Private bars are
      never shared unless you turn on Public.
    </span>
  </div>
);
