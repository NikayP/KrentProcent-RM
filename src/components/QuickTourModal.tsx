import React, { useState, useEffect } from 'react';
import {
  Compass,
  Beer,
  Sparkles,
  Trophy,
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  Coins,
  UserCheck,
} from 'lucide-react';

interface QuickTourProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: 'calculator' | 'scanner' | 'bars') => void;
}

interface TourStep {
  targetId?: string;
  title: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  actionTip: string;
  tabTarget?: 'calculator' | 'scanner' | 'bars';
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Why KrentProcent? Get the most joy out of every coin.',
    badge: 'Intro',
    icon: Coins,
    description:
      'Drinks have gotten expensive. KrentProcent calculates the pure alcohol efficiency for every option on the menu, so you get the most fun and value for your money.',
    actionTip: 'Take this short 4-step tour to see how to find the top deals in seconds.',
    tabTarget: 'calculator',
  },
  {
    targetId: 'tour-drink-presets',
    title: '1. Add drinks manually.',
    badge: 'Step 1 of 4',
    icon: Beer,
    description:
      'Add drinks in seconds using quick templates like a pint, vaasje, or tripel. Just adjust the price to see its instant score.',
    actionTip: 'The score shows how many millilitres of pure alcohol you get per euro or coin spent.',
    tabTarget: 'calculator',
  },
  {
    targetId: 'tour-krent-champion',
    title: '2. Spot the Krent Champion.',
    badge: 'Step 2 of 4',
    icon: Trophy,
    description:
      'The leaderboard crowns the #1 Krent Champion, showing you the absolute best deal at this bar and how much you save compared to other choices.',
    actionTip: 'Filter by beer or wine, or sort by value, lowest price, or alcohol percentage.',
    tabTarget: 'calculator',
  },
  {
    targetId: 'tour-scanner-sample',
    title: '3. Scan a menu with AI.',
    badge: 'Step 3 of 4',
    icon: Sparkles,
    description:
      'If you do not want to type everything manually, snap a photo of the pub menu or chalkboard. The AI extracts the drinks and prices for you.',
    actionTip: 'Click "Try Sample" on the scanner tab to see how the extraction works.',
    tabTarget: 'scanner',
  },
  {
    targetId: 'tour-account-btn',
    title: '4. Save your scans to an account.',
    badge: 'Step 4 of 4',
    icon: UserCheck,
    description:
      'Optionally create a free account to save and sync your bars and scanned menus across devices. You can always keep using the app without an account.',
    actionTip: 'Coming soon: browse, adopt, and update community-scanned bars by city.',
    tabTarget: 'calculator',
  },
];

export const QuickTourModal: React.FC<QuickTourProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  // Always reset to step 0 when reopened
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  const step = TOUR_STEPS[currentStep];
  const StepIcon = step.icon;
  const isLast = currentStep === TOUR_STEPS.length - 1;

  // Sync tab and update spotlight rectangle with smart viewport scrolling
  useEffect(() => {
    if (!isOpen) return;

    if (step.tabTarget) {
      onNavigateTab(step.tabTarget);
    }

    if (!step.targetId) {
      setTargetRect(null);
      return;
    }

    const updateRect = () => {
      // Find element or fallback to leaderboard container
      const el =
        document.getElementById(step.targetId!) ||
        (step.targetId === 'tour-krent-champion'
          ? document.getElementById('tour-leaderboard-banner')
          : null);

      if (!el) {
        setTargetRect(null);
        return;
      }

      const headerEl = document.querySelector('header');
      const isHeaderChild = headerEl ? headerEl.contains(el) : false;

      // Scroll element smoothly into visible zone (never hidden behind sticky header)
      if (isHeaderChild) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 100;
        const elTop = el.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({
          top: Math.max(0, elTop - headerHeight - 16),
          behavior: 'smooth',
        });
      }

      setTargetRect(el.getBoundingClientRect());
    };

    const timer1 = setTimeout(updateRect, 100);
    const timer2 = setTimeout(() => {
      const el =
        document.getElementById(step.targetId!) ||
        (step.targetId === 'tour-krent-champion'
          ? document.getElementById('tour-leaderboard-banner')
          : null);
      if (el) setTargetRect(el.getBoundingClientRect());
    }, 320);

    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [isOpen, currentStep, step.targetId, step.tabTarget, onNavigateTab]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (isLast) {
      onClose();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-auto">
      {/* Subtle backdrop overlay */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/35 transition-opacity duration-200"
      />

      {/* Spotlight highlight around active section */}
      {targetRect && (
        <div
          style={{
            top: `${Math.max(4, targetRect.top - 4)}px`,
            left: `${Math.max(4, targetRect.left - 4)}px`,
            width: `${Math.min(window.innerWidth - 8, targetRect.width + 8)}px`,
            height: `${targetRect.height + 8}px`,
          }}
          className="fixed pointer-events-none rounded-xl border-2 border-[#F21B2D] shadow-[0_0_0_3px_rgba(242,27,45,0.22),0_0_20px_rgba(242,27,45,0.3)] transition-all duration-200 z-40 animate-pulse"
        />
      )}

      {/* Floating Tour Card - positioned above BottomTabBar on mobile */}
      <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] sm:bottom-5 left-1/2 -translate-x-1/2 w-full max-w-lg px-3 sm:px-4 z-50">
        <div className="bg-[#FFFFFF] dark:bg-[#18181B] border border-[#F21B2D]/40 rounded-2xl p-3 sm:p-5 shadow-2xl relative text-[#18181B] dark:text-[#FFFFFF] space-y-2 sm:space-y-3">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-2.5 right-2.5 sm:top-3.5 sm:right-3.5 text-zinc-400 hover:text-[#18181B] dark:hover:text-white p-1 rounded-xl hover:bg-[#FFF2F3] dark:hover:bg-[#27272A] transition-colors cursor-pointer"
            title="Close tour"
            aria-label="Close tour"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Header with Icon & Badge */}
          <div className="flex items-center gap-2 sm:gap-3 pr-6">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#FF8A8E]/20 text-[#F21B2D] flex items-center justify-center shrink-0 border border-[#FF8A8E]/40 shadow-sm">
              <StepIcon className="w-4 h-4 sm:w-5 sm:h-5 text-[#F21B2D]" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#D91424] dark:text-[#FF8A8E] bg-[#FF8A8E]/20 px-1.5 sm:px-2 py-0.5 rounded-full border border-[#FF8A8E]/40">
                {step.badge}
              </span>
              <h3 className="text-xs sm:text-base font-extrabold tracking-[-0.02em] text-[#18181B] dark:text-[#FFFFFF] mt-0.5 truncate">
                {step.title}
              </h3>
            </div>
          </div>

          {/* Description */}
          <p className="text-[11px] sm:text-sm text-zinc-600 dark:text-zinc-300 leading-snug sm:leading-relaxed">
            {step.description}
          </p>

          {/* Action Tip */}
          <div className="bg-[#FFF2F3] dark:bg-[#121214] p-2 sm:p-2.5 rounded-xl border border-[#E4E4E7] dark:border-[#27272A] text-[11px] sm:text-xs text-[#D91424] dark:text-[#FF8A8E] font-medium flex items-start gap-1.5 sm:gap-2">
            <Compass className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#F21B2D] shrink-0 mt-0.5" />
            <span className="leading-tight sm:leading-normal">{step.actionTip}</span>
          </div>

          {/* Navigation Bar */}
          <div className="flex items-center justify-between pt-1 border-t border-[#E4E4E7] dark:border-[#27272A]">
            {/* Progress Dots */}
            <div className="flex items-center gap-1.5">
              {TOUR_STEPS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentStep(idx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    idx === currentStep ? 'w-4 sm:w-5 bg-[#F21B2D]' : 'w-1.5 bg-zinc-300 dark:bg-[#27272A] hover:bg-[#FF8A8E]'
                  }`}
                  aria-label={`Go to step ${idx + 1}`}
                />
              ))}
            </div>

            {/* Next / Prev Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {currentStep > 0 && (
                <button
                  onClick={handlePrev}
                  className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-semibold rounded-xl text-zinc-600 dark:text-zinc-300 hover:text-[#18181B] dark:hover:text-white hover:bg-[#FFF2F3] dark:hover:bg-[#27272A] transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Back</span>
                </button>
              )}

              <button
                onClick={handleNext}
                className="px-3.5 sm:px-4 py-1 sm:py-2 text-xs font-extrabold tracking-[-0.01em] rounded-xl bg-[#F21B2D] hover:bg-[#D91424] text-white transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                {isLast ? (
                  <>
                    <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>Got it</span>
                  </>
                ) : (
                  <>
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
