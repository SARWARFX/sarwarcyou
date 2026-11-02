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
      className={`fixed top-4 sm:top-6 inset-x-0 mx-auto z-[10005] max-w-sm sm:max-w-md w-[calc(100%-2rem)] transition-all duration-300 ease-out select-none font-serif ${
        isVisible
          ? 'translate-y-0 opacity-100 scale-100 pointer-events-auto'
          : '-translate-y-6 opacity-0 scale-95 pointer-events-none'
      } ${className}`}
    >
      <div
        className={`relative flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-lg border backdrop-blur-xl transition-all duration-300 shadow-xl ${
          isOffline
            ? 'bg-[#121110]/95 border-amber-800/60 text-amber-100'
            : 'bg-[#0f1412]/95 border-neutral-700 text-neutral-100'
        }`}
      >
        {/* Ambient icon */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-md flex items-center justify-center flex-shrink-0 border transition-all ${
              isOffline
                ? 'bg-amber-950/40 border-amber-700/50 text-amber-400'
                : 'bg-neutral-900 border-neutral-700 text-neutral-200'
            }`}
          >
            {isOffline ? (
              <WifiOff className="w-5 h-5" />
            ) : (
              <div className="relative">
                <Wifi className="w-5 h-5" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-normal text-white">
                {isOffline ? 'You Are Currently Offline' : 'Connection Restored'}
              </h4>
              <span
                className={`text-[9px] font-normal px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                  isOffline
                    ? 'bg-amber-950/30 text-amber-300 border-amber-800/40'
                    : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                }`}
              >
                {isOffline ? 'OFFLINE' : 'ONLINE'}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-neutral-400 truncate mt-0.5 font-normal">
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
