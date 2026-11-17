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
          className="fixed inset-0 z-50 w-screen h-[100dvh] flex items-center justify-center p-4 text-white bg-black/85 backdrop-blur-[20px] select-none"
          style={{ borderRadius: 0, outline: 'none', border: 'none' }}
        >
          <div
            className="p-8 max-w-md w-full flex flex-col gap-4 bg-[#090c12] shadow-2xl"
            style={{ borderRadius: 0, outline: 'none', border: 'none' }}
          >
            <h3 className="text-base font-bold font-mono tracking-tight text-[#ef4444] uppercase">
              // PLAYBACK ERROR
            </h3>

            <p className="text-xs text-neutral-300 font-sans leading-relaxed">
              {this.props.fallbackTitle || 'Unable to decode media stream. A network interruption or codec stall occurred.'}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleRetry}
                className="py-2 px-4 bg-transparent text-neutral-300 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer"
                style={{ borderRadius: 0, outline: 'none', border: 'none' }}
              >
                Retry
              </button>
              {this.props.onClose && (
                <button
                  type="button"
                  onClick={this.props.onClose}
                  className="py-2 px-4 bg-[#ef4444] text-white font-mono font-bold text-xs uppercase tracking-wider hover:bg-white hover:text-black transition-colors cursor-pointer"
                  style={{ borderRadius: 0, outline: 'none', border: 'none' }}
                >
                  Close
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
