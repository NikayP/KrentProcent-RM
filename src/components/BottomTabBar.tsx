import React from 'react';
import { Beer, Camera, Store } from 'lucide-react';

interface BottomTabBarProps {
  activeTab: 'calculator' | 'scanner' | 'bars';
  onSelectTab: (tab: 'calculator' | 'scanner' | 'bars') => void;
  drinkCount: number;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  onSelectTab,
  drinkCount,
}) => {
  return (
    <nav
      aria-label="Primary navigation"
      role="tablist"
      className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-[#FFFFFF]/95 dark:bg-[#18181B]/95 backdrop-blur-md border-t border-[#E4E4E7] dark:border-[#27272A] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.4)] pb-[env(safe-area-inset-bottom)] select-none transition-colors duration-200"
    >
      <div className="grid grid-cols-3 h-16 max-w-lg mx-auto px-2">
        {/* Tab 1: Drinks */}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'calculator'}
          onClick={() => onSelectTab('calculator')}
          className="group flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform duration-150 focus:outline-none"
        >
          <span
            className={`relative flex items-center justify-center w-14 h-7 rounded-full transition-colors duration-150 ${
              activeTab === 'calculator'
                ? 'bg-[#F21B2D] text-white shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 group-hover:text-[#18181B] dark:group-hover:text-white'
            }`}
          >
            <Beer className="w-4 h-4" />
            {drinkCount > 0 && (
              <span
                className={`absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-extrabold tabular-nums flex items-center justify-center border ${
                  activeTab === 'calculator'
                    ? 'bg-[#FFFFFF] text-[#F21B2D] border-[#F21B2D]'
                    : 'bg-[#FFF2F3] dark:bg-[#27272A] text-zinc-700 dark:text-zinc-200 border-[#E4E4E7] dark:border-[#3F3F46]'
                }`}
              >
                {drinkCount > 99 ? '99+' : drinkCount}
              </span>
            )}
          </span>
          <span
            className={`text-[11px] leading-tight transition-colors ${
              activeTab === 'calculator'
                ? 'font-extrabold text-[#F21B2D] dark:text-[#FF8A8E]'
                : 'font-semibold text-zinc-500 dark:text-zinc-400'
            }`}
          >
            Drinks
          </span>
        </button>

        {/* Tab 2: Scan Menu */}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'scanner'}
          onClick={() => onSelectTab('scanner')}
          className="group flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform duration-150 focus:outline-none"
        >
          <span
            className={`flex items-center justify-center w-14 h-7 rounded-full transition-colors duration-150 ${
              activeTab === 'scanner'
                ? 'bg-[#F21B2D] text-white shadow-sm'
                : 'bg-[#FF8A8E]/15 text-[#D91424] dark:text-[#FF8A8E] group-hover:bg-[#FF8A8E]/25'
            }`}
          >
            <Camera className="w-4 h-4" />
          </span>
          <span
            className={`text-[11px] leading-tight transition-colors ${
              activeTab === 'scanner'
                ? 'font-extrabold text-[#F21B2D] dark:text-[#FF8A8E]'
                : 'font-bold text-[#D91424] dark:text-[#FF8A8E]'
            }`}
          >
            Scan Menu
          </span>
        </button>

        {/* Tab 3: Bar Hub */}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'bars'}
          onClick={() => onSelectTab('bars')}
          className="group flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform duration-150 focus:outline-none"
        >
          <span
            className={`relative flex items-center justify-center w-14 h-7 rounded-full transition-colors duration-150 ${
              activeTab === 'bars'
                ? 'bg-[#F21B2D] text-white shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 group-hover:text-[#18181B] dark:group-hover:text-white'
            }`}
          >
            <Store className="w-4 h-4" />
          </span>
          <span
            className={`text-[11px] leading-tight transition-colors ${
              activeTab === 'bars'
                ? 'font-extrabold text-[#F21B2D] dark:text-[#FF8A8E]'
                : 'font-semibold text-zinc-500 dark:text-zinc-400'
            }`}
          >
            Bar Hub
          </span>
        </button>
      </div>
    </nav>
  );
};
