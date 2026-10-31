import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Wifi, WifiOff, X } from 'lucide-react';

export interface NetworkStatusHUDProps {
  className?: string;
  autoDismissOnlineMs?: number;
}

export const NetworkStatusHUD: React.FC<NetworkStatusHUDProps> = ({
  className = '',
  autoDismissOnlineMs = 4000,
}) => {
  const [status, setStatus] = useState<'online' | 'offline' | 'idle'>(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return 'offline';
    }
    return 'idle';
  });

  const [isVisible, setIsVisible] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' && !navigator.onLine;
  });

  const wasOfflineRef = useRef<boolean>(typeof navigator !== 'undefined' && !navigator.onLine);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      clearTimer();
      // Only show the "back online" notification if the user was detected offline
      if (wasOfflineRef.current) {
        setStatus('online');
        setIsVisible(true);
        wasOfflineRef.current = false;

        // Auto-dismiss after configured duration
        dismissTimerRef.current = setTimeout(() => {
          setIsVisible(false);
          dismissTimerRef.current = setTimeout(() => {
            setStatus('idle');
          }, 350);
        }, autoDismissOnlineMs);
      }
    };

    const handleOffline = () => {
      clearTimer();
      wasOfflineRef.current = true;
      setStatus('offline');
      setIsVisible(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearTimer();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [clearTimer, autoDismissOnlineMs]);

  const handleDismiss = () => {
    clearTimer();
    setIsVisible(false);
    setTimeout(() => {
      if (status === 'online') {
        setStatus('idle');
      }
    }, 350);
  };

  if (status === 'idle' && !isVisible) {
    return null;
  }

  const isOffline = status === 'offline';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-4 sm:top-6 inset-x-0 mx-auto z-[10005] max-w-sm sm:max-w-md w-[calc(100%-2rem)] transition-all duration-300 ease-out select-none ${
        isVisible
          ? 'translate-y-0 opacity-100 scale-100 pointer-events-auto'
          : '-translate-y-6 opacity-0 scale-95 pointer-events-none'
      } ${className}`}
    >
      <div
        className={`relative flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-2xl border backdrop-blur-2xl transition-all duration-300 shadow-2xl ${
          isOffline
            ? 'bg-[#0f0b08]/90 border-amber-500/40 text-amber-200 shadow-[0_12px_40px_rgba(245,158,11,0.2)]'
            : 'bg-[#07130e]/90 border-emerald-500/40 text-emerald-200 shadow-[0_12px_40px_rgba(16,185,129,0.25),0_0_24px_rgba(0,240,255,0.15)]'
        }`}
      >
        {/* Glow ambient icon pill */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 border transition-all ${
              isOffline
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
            }`}
          >
            {isOffline ? (
              <WifiOff className="w-5 h-5 animate-pulse" />
            ) : (
              <div className="relative">
                <Wifi className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-bold font-sans tracking-wide text-white">
                {isOffline ? 'You Are Currently Offline' : 'Connection Restored'}
              </h4>
              <span
                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                  isOffline
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                }`}
              >
                {isOffline ? 'OFFLINE' : 'ONLINE'}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs font-mono text-zinc-300/90 truncate mt-0.5">
              {isOffline
                ? 'Your device has lost internet connectivity.'
                : 'Your device is connected to the internet again.'}
            </p>
          </div>
        </div>

        {/* Dismiss button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.06] hover:bg-white/[0.12] text-zinc-400 hover:text-white transition-all flex-shrink-0 cursor-pointer border border-white/10 active:scale-95"
          title="Dismiss notification"
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default NetworkStatusHUD;
