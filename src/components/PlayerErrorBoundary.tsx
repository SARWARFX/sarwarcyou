import React, { Component, type ReactNode } from 'react';

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
    console.error('Player error caught:', error, errorInfo);
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
          className="fixed inset-0 z-[99999] w-screen h-[100dvh] flex items-center justify-center p-4 text-white bg-black/45 backdrop-blur-[10px] select-none pointer-events-auto animate-fade-in"
          style={{ borderRadius: 0, outline: 'none', border: 'none' }}
        >
          <div
            className="p-6 sm:p-7 max-w-md w-full flex flex-col gap-4 shadow-[0_30px_80px_rgba(0,0,0,0.75)] animate-scale-in"
            style={{
              borderRadius: 0,
              outline: 'none',
              border: 'none',
              background: 'rgba(10, 14, 23, 0.58)',
              backdropFilter: 'blur(32px) saturate(190%)',
              WebkitBackdropFilter: 'blur(32px) saturate(190%)',
              boxShadow: '0 30px 80px rgba(0, 0, 0, 0.75), 0 0 1px rgba(255, 255, 255, 0.2) inset',
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-bold font-mono tracking-tight text-[#ef4444] uppercase flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#ef4444] animate-ping inline-block shrink-0 shadow-[0_0_8px_#ef4444]" />
                // PLAYBACK ERROR
              </h3>
              {this.props.onClose && (
                <button
                  type="button"
                  onClick={this.props.onClose}
                  className="w-7 h-7 flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-base font-mono p-0"
                  style={{ borderRadius: 0, outline: 'none', border: 'none', background: 'transparent' }}
                  title="Close Dialog"
                >
                  ✕
                </button>
              )}
            </div>

            <p className="text-xs sm:text-sm text-neutral-300 font-sans leading-relaxed">
              {this.props.fallbackTitle || 'Unable to decode media stream. A network interruption or codec stall occurred.'}
            </p>

            <div className="bg-[#030508]/45 p-2.5 text-[11px] font-mono text-neutral-400 flex items-center justify-between">
              <span className="text-[#ef4444] font-bold">CODEC // STALL</span>
              <span className="text-neutral-500">DECODE FAILURE</span>
            </div>

            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={this.handleRetry}
                className="py-2 px-4 bg-white/15 text-white hover:bg-white hover:text-black font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer font-bold"
                style={{ borderRadius: 0, outline: 'none', border: 'none' }}
              >
                Retry Playback
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default PlayerErrorBoundary;
