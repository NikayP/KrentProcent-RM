import React from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { attemptStaleChunkReload, isChunkLoadError } from '../utils/lazyWithRetry';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
  onBack?: () => void;
  backLabel?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  isChunkError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, isChunkError: false };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      isChunkError: isChunkLoadError(error),
    };
  }

  componentDidCatch(error: unknown) {
    console.error('[KrentProcent] UI ErrorBoundary caught:', error);
    if (isChunkLoadError(error)) {
      attemptStaleChunkReload();
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const title = this.state.isChunkError
      ? 'App update ready'
      : this.props.fallbackTitle || 'Something went wrong';
    const description = this.state.isChunkError
      ? 'A newer version of KrentProcent was deployed. Reload the page to continue.'
      : this.props.fallbackDescription ||
        'This view ran into an unexpected error. Reloading usually fixes it right away.';

    return (
      <div className="bg-[#FFFFFF] dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-2xl p-6 max-w-md mx-auto my-6 shadow-sm text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[#F21B2D]/10 border border-[#F21B2D]/25 text-[#F21B2D] flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-extrabold tracking-[-0.02em] text-[#18181B] dark:text-[#FFFFFF]">
            {title}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {description}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={this.handleReload}
            className="px-4 py-2.5 rounded-xl bg-[#F21B2D] hover:bg-[#D91424] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload App</span>
          </button>
          {this.props.onBack && (
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, isChunkError: false });
                this.props.onBack?.();
              }}
              className="px-4 py-2.5 rounded-xl bg-[#FFF2F3] dark:bg-[#121214] hover:bg-[#FF8A8E]/20 text-[#18181B] dark:text-zinc-200 border border-[#E4E4E7] dark:border-[#27272A] text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{this.props.backLabel || 'Back'}</span>
            </button>
          )}
        </div>
      </div>
    );
  }
}
