import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
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
import { useFocusTrap } from '../hooks/useFocusTrap';

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
  hint: string;
  tabTarget?: 'calculator' | 'scanner' | 'bars';
}

const TOUR_STEPS: TourStep[] = [
  {
    badge: 'Welcome',
    title: 'Get the most joy out of every coin.',
    icon: Coins,
    description:
      'KrentProcent calculates pure alcohol efficiency (ml per euro or coin) for every option on the menu, so you spot the best value in seconds.',
    hint: '4 quick steps — takes about 20 seconds.',
    tabTarget: 'calculator',
  },
  {
    targetId: 'tour-drink-presets',
    badge: '1 / 4 · Manual Entry',
    title: 'Add drinks in a tap',
    icon: Beer,
    description:
      'Tap + Add Drink to log any drink, or pick Vaasje, Pint, or Tripel to prefill the form and just adjust the price.',
    hint: 'Higher ml/€ means more pure alcohol for your money.',
    tabTarget: 'calculator',
  },
  {
    targetId: 'tour-krent-champion',
    badge: '2 / 4 · Leaderboard',
    title: 'Spot the Krent Champion',
    icon: Trophy,
    description:
      'Your #1 deal sits right at the top of the leaderboard, showing how much better it scores compared to other options at this bar.',
    hint: 'Filter by category or sort by value, price, or ABV.',
    tabTarget: 'calculator',
  },
  {
    targetId: 'tour-scanner-sample',
    badge: '3 / 4 · AI Menu Scanner',
    title: 'Scan a whole menu at once',
    icon: Sparkles,
    description:
      'Snap a photo or upload a PDF of a pub menu or chalkboard. AI extracts every drink, volume, ABV, and price automatically.',
    hint: 'You can also paste copied menu text — it works offline too.',
    tabTarget: 'scanner',
  },
  {
    targetId: 'tour-account-btn',
    badge: '4 / 4 · Account & Hub',
    title: 'Sync bars & explore community menus',
    icon: UserCheck,
    description:
      'Create a free account to back up and sync your bars across devices. You can also keep using the app locally without an account.',
    hint: 'Share bars publicly and adopt menus from friends in Bar Hub › Discover.',
    tabTarget: 'calculator',
  },
];

function findTargetElement(targetId?: string): HTMLElement | null {
  if (!targetId) return null;
  const primary = document.getElementById(targetId);
  if (primary) return primary;
  if (targetId === 'tour-krent-champion') {
    return document.getElementById('tour-leaderboard-banner');
  }
  return null;
}

export const QuickTourModal: React.FC<QuickTourProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, isOpen);

  // Always reset to step 0 when reopened
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  const step = TOUR_STEPS[currentStep];
  const StepIcon = step.icon;
  const isLast = currentStep === TOUR_STEPS.length - 1;
  const isIntro = currentStep === 0;

  const handleNext = useCallback(() => {
    if (isLast) {
      onClose();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  }, [isLast, onClose]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  // Keyboard navigation (Escape, Left / Right arrows)
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose]);

  // Sync tab, wait for lazy-loaded targets, scroll once cleanly, and track layout shifts
  useEffect(() => {
    if (!isOpen) return;

    if (step.tabTarget) {
      onNavigateTab(step.tabTarget);
    }

    if (!step.targetId) {
      setTargetRect(null);
      return;
    }

    let hasScrolledForStep = false;
    let resizeObserver: ResizeObserver | null = null;
    let observedEl: HTMLElement | null = null;

    const measureAndAttach = () => {
      const el = findTargetElement(step.targetId);
      if (!el) {
        setTargetRect(null);
        return false;
      }

      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        setTargetRect(null);
        return false;
      }

      if (!hasScrolledForStep) {
        hasScrolledForStep = true;
        const headerEl = document.querySelector('header');
        const isHeaderChild = headerEl ? headerEl.contains(el) : false;
        const scrollBehavior: ScrollBehavior = window.matchMedia?.(
          '(prefers-reduced-motion: reduce)'
        ).matches
          ? 'auto'
          : 'smooth';
        if (isHeaderChild) {
          window.scrollTo({ top: 0, behavior: scrollBehavior });
        } else {
          const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 96;
          const elTop = rect.top + window.scrollY;
          window.scrollTo({
            top: Math.max(0, elTop - headerHeight - 16),
            behavior: scrollBehavior,
          });
        }
      }

      if (observedEl !== el) {
        resizeObserver?.disconnect();
        observedEl = el;
        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => {
            const nextRect = el.getBoundingClientRect();
            if (nextRect.width > 0 && nextRect.height > 0) {
              setTargetRect(nextRect);
            }
          });
          resizeObserver.observe(el);
        }
      }

      setTargetRect(el.getBoundingClientRect());
      return true;
    };

    const refreshRectOnly = () => {
      const el = findTargetElement(step.targetId);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setTargetRect(rect);
      }
    };

    // Initial check + MutationObserver for lazy-loaded routes (e.g. MenuScanner)
    measureAndAttach();
    const mutationObserver = new MutationObserver(() => {
      if (measureAndAttach()) {
        // Keep observing resize/scroll, stop polling DOM additions after target appears
        mutationObserver.disconnect();
      }
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    // Re-measure briefly while smooth scrolling settles
    const settleTimers = [80, 220, 420].map((ms) => setTimeout(measureAndAttach, ms));

    window.addEventListener('resize', refreshRectOnly);
    window.addEventListener('scroll', refreshRectOnly, true);

    return () => {
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
      settleTimers.forEach(clearTimeout);
      window.removeEventListener('resize', refreshRectOnly);
      window.removeEventListener('scroll', refreshRectOnly, true);
    };
  }, [isOpen, currentStep, step.targetId, step.tabTarget, onNavigateTab]);

  if (!isOpen) return null;

  // Place card opposite the spotlight so it never hides the highlighted target
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const placeCardAtTop =
    !isIntro &&
    targetRect !== null &&
    targetRect.top + targetRect.height / 2 > viewportHeight * 0.55 &&
    targetRect.top > 240;

  const cardContainerClass = isIntro
    ? 'fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none'
    : placeCardAtTop
      ? 'fixed top-[calc(env(safe-area-inset-top)+0.75rem)] left-1/2 -translate-x-1/2 w-full max-w-md px-3 sm:px-4 z-50'
      : 'fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] sm:bottom-5 left-1/2 -translate-x-1/2 w-full max-w-md px-3 sm:px-4 z-50';

  return (
    <div className="fixed inset-0 z-50 pointer-events-auto">
      {/* Click-outside handler + dimmed backdrop when there is no cutout spotlight */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 transition-colors duration-300 ${
          targetRect ? 'bg-transparent' : 'bg-black/55 backdrop-blur-[1px]'
        }`}
      />

      {/* True cutout spotlight: dims everything outside the highlighted element */}
      {targetRect && (
        <div
          style={{
            top: `${Math.max(4, targetRect.top - 5)}px`,
            left: `${Math.max(4, targetRect.left - 5)}px`,
            width: `${Math.min(viewportWidth - 8, targetRect.width + 10)}px`,
            height: `${Math.min(viewportHeight - 8, targetRect.height + 10)}px`,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.58), 0 0 24px rgba(242, 27, 45, 0.28)',
          }}
          className="fixed pointer-events-none rounded-2xl border-2 border-[#F21B2D] transition-[top,left,width,height] duration-300 ease-out z-40"
        />
      )}

      {/* Floating Tour Card */}
      <div className={cardContainerClass}>
        <div
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-step-title"
          className="pointer-events-auto w-full max-w-md bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl p-4 sm:p-5 shadow-2xl relative text-[#18181B] dark:text-[#FFFFFF] space-y-3 focus:outline-none"
        >
          {/* Thin top progress bar across all steps */}
          <div className="grid grid-cols-5 gap-1 pr-7">
            {TOUR_STEPS.map((s, idx) => (
              <button
                key={s.badge}
                type="button"
                onClick={() => setCurrentStep(idx)}
                aria-label={`Go to ${s.badge}`}
                className={`h-1 rounded-full transition-colors cursor-pointer ${
                  idx <= currentStep
                    ? 'bg-[#F21B2D]'
                    : 'bg-zinc-200 dark:bg-[#27272A] hover:bg-[#FF8A8E]/60'
                }`}
              />
            ))}
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 text-zinc-400 hover:text-[#18181B] dark:hover:text-white p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-[#27272A] transition-colors cursor-pointer"
            title="Close tour"
            aria-label="Close tour"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header: Clean Icon + Step Label + Full Title (never truncated) */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FFF2F3] dark:bg-[#F21B2D]/15 text-[#F21B2D] flex items-center justify-center shrink-0 border border-[#FF8A8E]/30 dark:border-[#F21B2D]/30">
              <StepIcon className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#F21B2D] dark:text-[#FF8A8E]">
                {step.badge}
              </span>
              <h3
                id="tour-step-title"
                className="text-sm sm:text-base font-extrabold tracking-[-0.02em] text-[#18181B] dark:text-[#FFFFFF] leading-snug mt-0.5"
              >
                {step.title}
              </h3>
            </div>
          </div>

          {/* Concise Description + Subtle Hint */}
          <div className="space-y-1.5">
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {step.description}
            </p>
            <p className="text-[11px] sm:text-xs font-medium text-zinc-500 dark:text-zinc-400">
              <span className="text-[#F21B2D] font-bold mr-1">Tip:</span>
              {step.hint}
            </p>
          </div>

          {/* Footer Navigation */}
          <div className="flex items-center justify-between pt-2 border-t border-[#E4E4E7] dark:border-[#27272A]">
            {isLast ? (
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">
                Cheers!
              </span>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-medium text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors cursor-pointer"
              >
                Skip tour
              </button>
            )}

            <div className="flex items-center gap-1.5">
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-xl text-zinc-600 dark:text-zinc-300 hover:text-[#18181B] dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-[#27272A] transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-1.5 sm:py-2 text-xs font-extrabold rounded-xl bg-[#F21B2D] hover:bg-[#D91424] text-white transition-colors shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
              >
                {isLast ? (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[2.75]" />
                    <span>Got it</span>
                  </>
                ) : (
                  <>
                    <span>{isIntro ? 'Start tour' : 'Next'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
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
