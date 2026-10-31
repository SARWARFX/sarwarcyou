import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';

export interface PlayerErrorBoundaryProps {
  children: ReactNode;
  onClose?: () => void;
  fallbackTitle?: string;
}

interface PlayerErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class PlayerErrorBoundary extends Component<PlayerErrorBoundaryProps, PlayerErrorBoundaryState> {
  constructor(props: PlayerErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): PlayerErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Player runtime error caught by PlayerErrorBoundary:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 w-[100vw] h-[100dvh] flex items-center justify-center p-4 text-white"
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100dvh',
            zIndex: 50,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'rgba(3, 5, 10, 0.75)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          {/* Close button in top-right */}
          {this.props.onClose && (
            <button
              type="button"
              onClick={this.props.onClose}
              className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-[#00f0ff]/20 border border-white/20 hover:border-[#00f0ff] text-white flex items-center justify-center transition-all cursor-pointer z-50"
              aria-label="Close"
              title="Close Player (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div
            className="p-6 sm:p-8 rounded-2xl max-w-md w-full flex flex-col items-center text-center gap-4 border shadow-2xl"
            style={{
              background: 'rgba(8, 12, 24, 0.85)',
              backdropFilter: 'blur(20px)',
              borderColor: 'rgba(0, 240, 255, 0.3)',
              boxShadow: '0 0 35px rgba(0, 240, 255, 0.2)',
            }}
          >
            <div className="w-12 h-12 rounded-full bg-[#00f0ff]/10 border border-[#00f0ff]/40 flex items-center justify-center text-[#00f0ff]">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="flex flex-col gap-1.5">
              <h3 className="text-lg font-bold text-white tracking-wide">
                {this.props.fallbackTitle || 'Unable to Load Media'}
              </h3>
              <p className="text-xs text-zinc-300 font-mono leading-relaxed">
                A playback or resolution issue occurred. You can retry loading or return to the directory explorer.
              </p>
            </div>

            <div className="flex items-center gap-3 mt-2 w-full">
              <button
                type="button"
                onClick={this.handleRetry}
                className="flex-1 py-2 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-mono font-semibold flex items-center justify-center gap-2 border border-white/15 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Retry
              </button>
              {this.props.onClose && (
                <button
                  type="button"
                  onClick={this.props.onClose}
                  className="flex-1 py-2 px-4 rounded-xl bg-[#00f0ff]/20 hover:bg-[#00f0ff]/30 text-[#00f0ff] text-xs font-mono font-bold flex items-center justify-center border border-[#00f0ff]/40 transition-all cursor-pointer"
                >
                  Return to Explorer
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default PlayerErrorBoundary;
