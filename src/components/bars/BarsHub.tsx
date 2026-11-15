import React from 'react';
import { Compass, Store, User, UserCheck } from 'lucide-react';
import type { DrinkItem } from '../../utils/calculator';
import type { BarShareInfo } from '../../hooks/usePublicBarsSync';
import { CrossBarComparison } from '../CrossBarComparison';
import { DiscoverPanel } from './DiscoverPanel';
import { AccountPanel, type AccountPanelProps } from '../account/AccountPanel';

export type BarsSubTab = 'my-bars' | 'discover' | 'account';

interface BarsHubProps {
  subTab: BarsSubTab;
  onSelectSubTab: (sub: BarsSubTab) => void;
  discoverQuery: string;
  onDiscoverQueryChange: (q: string) => void;
  isAccountsEnabled: boolean;
  drinks: DrinkItem[];
  extraBars: string[];
  availableBars: string[];
  currency: string;
  onSelectBar: (barName: string) => void;
  onAddBar: (barName: string) => void;
  onRenameBar: (oldName: string, newName: string) => void;
  onDeleteBar: (barName: string) => void;
  shareState: Record<string, BarShareInfo>;
  updatingBarKey: string | null;
  onSetBarPublic: (barName: string, isPublic: boolean, city: string | null) => void;
  accountDisplayName: string | null;
  onAdoptBar: (drinks: DrinkItem[], sourceUsername: string, barName: string) => void;
  accountProps: Omit<AccountPanelProps, 'onClose' | 'onSubmittingChange' | 'titleId'>;
}

export const BarsHub: React.FC<BarsHubProps> = ({
  subTab,
  onSelectSubTab,
  discoverQuery,
  onDiscoverQueryChange,
  isAccountsEnabled,
  drinks,
  extraBars,
  availableBars,
  currency,
  onSelectBar,
  onAddBar,
  onRenameBar,
  onDeleteBar,
  shareState,
  updatingBarKey,
  onSetBarPublic,
  accountDisplayName,
  onAdoptBar,
  accountProps,
}) => {
  const effectiveSubTab: BarsSubTab = isAccountsEnabled ? subTab : 'my-bars';

  return (
    <div className="space-y-5">
      {/* Segmented Sub-Tab Control */}
      {isAccountsEnabled && (
        <div
          role="tablist"
          aria-label="Bar Hub sections"
          className="inline-flex w-full sm:w-auto p-1 rounded-2xl bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] shadow-sm gap-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={effectiveSubTab === 'my-bars'}
            onClick={() => onSelectSubTab('my-bars')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              effectiveSubTab === 'my-bars'
                ? 'bg-[#F21B2D] text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-300 hover:bg-[#FFF2F3] dark:hover:bg-[#27272A]'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>My Bars</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={effectiveSubTab === 'discover'}
            onClick={() => onSelectSubTab('discover')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              effectiveSubTab === 'discover'
                ? 'bg-[#F21B2D] text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-300 hover:bg-[#FFF2F3] dark:hover:bg-[#27272A]'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Discover</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={effectiveSubTab === 'account'}
            onClick={() => onSelectSubTab('account')}
            className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              effectiveSubTab === 'account'
                ? 'bg-[#F21B2D] text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-300 hover:bg-[#FFF2F3] dark:hover:bg-[#27272A]'
            }`}
          >
            {accountProps.session ? (
              <UserCheck className="w-3.5 h-3.5" />
            ) : (
              <User className="w-3.5 h-3.5" />
            )}
            <span>Account</span>
          </button>
        </div>
      )}

      {effectiveSubTab === 'my-bars' && (
        <CrossBarComparison
          drinks={drinks}
          extraBars={extraBars}
          currency={currency}
          onSelectBar={onSelectBar}
          onAddBar={onAddBar}
          onRenameBar={onRenameBar}
          onDeleteBar={onDeleteBar}
          canShare={Boolean(accountProps.session)}
          shareState={shareState}
          updatingBarKey={updatingBarKey}
          onSetBarPublic={onSetBarPublic}
          onPromptLogin={
            isAccountsEnabled ? () => onSelectSubTab('account') : undefined
          }
          accountDisplayName={accountDisplayName}
        />
      )}

      {effectiveSubTab === 'discover' && isAccountsEnabled && (
        <DiscoverPanel
          currency={currency}
          existingBars={availableBars}
          initialQuery={discoverQuery}
          onQueryChange={onDiscoverQueryChange}
          onAdoptBar={onAdoptBar}
        />
      )}

      {effectiveSubTab === 'account' && isAccountsEnabled && (
        <AccountPanel
          {...accountProps}
          titleId="bars-account-title"
          barCount={availableBars.length}
          publicBarCount={
            Object.values(shareState).filter((info) => info.isPublic).length
          }
          onGoToMyBars={() => onSelectSubTab('my-bars')}
          onGoToDiscover={() => onSelectSubTab('discover')}
        />
      )}
    </div>
  );
};
