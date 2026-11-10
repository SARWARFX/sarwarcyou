import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Wifi, WifiOff, X } from 'lucide-react';

export interface NetworkStatusHUDProps {
  className?: string;
  autoDismissOnlineMs?: number;
}

export const NetworkStatusHUD: React.FC<NetworkStatusHUDProps> = ({
  className = '',
  autoDismissOnlineMs = 3500,
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

  const handleOfflineTransition = useCallback(() => {
    clearTimer();
    wasOfflineRef.current = true;
    setStatus('offline');
    setIsVisible(true);
  }, [clearTimer]);

  const handleOnlineTransition = useCallback(() => {
    clearTimer();
    if (wasOfflineRef.current) {
      setStatus('online');
      setIsVisible(true);
      wasOfflineRef.current = false;

      dismissTimerRef.current = setTimeout(() => {
        setIsVisible(false);
        dismissTimerRef.current = setTimeout(() => {
          setStatus('idle');
        }, 350);
      }, autoDismissOnlineMs);
    }
  }, [clearTimer, autoDismissOnlineMs]);

  useEffect(() => {
    // 1. Initial check
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      handleOfflineTransition();
    }

    // 2. Browser DOM Events
    const handleDomOnline = () => handleOnlineTransition();
    const handleDomOffline = () => handleOfflineTransition();

    window.addEventListener('online', handleDomOnline);
    window.addEventListener('offline', handleDomOffline);

    // 3. Periodic heartbeat check (every 5 seconds)
    const heartbeatInterval = setInterval(() => {
      if (typeof navigator !== 'undefined') {
        if (!navigator.onLine) {
          handleOfflineTransition();
        } else if (wasOfflineRef.current) {
          handleOnlineTransition();
        }
      }
    }, 5000);

    return () => {
      clearTimer();
      clearInterval(heartbeatInterval);
      window.removeEventListener('online', handleDomOnline);
      window.removeEventListener('offline', handleDomOffline);
    };
  }, [clearTimer, handleOfflineTransition, handleOnlineTransition]);

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
    <aside
      role="status"
      aria-live="polite"
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] pointer-events-auto transition-all duration-300 ease-out ${
        isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-3 scale-95 pointer-events-none'
      } ${className}`}
    >
      <div
        className={`flex items-center gap-2.5 px-4 py-2 rounded-full border shadow-2xl backdrop-blur-xl text-xs font-mono transition-colors duration-200 ${
          isOffline
            ? 'bg-neutral-900/95 border-rose-500/40 text-rose-300 shadow-rose-950/40'
            : 'bg-neutral-900/95 border-emerald-500/40 text-emerald-300 shadow-emerald-950/40'
        }`}
      >
        {isOffline ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
            </span>
            <WifiOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <div className="flex flex-col">
              <span className="font-semibold tracking-wide text-rose-200">YOU'RE OFFLINE</span>
              <span className="text-[10px] text-rose-400/80">Check your internet connection</span>
            </div>
          </>
        ) : (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div className="flex flex-col">
              <span className="font-semibold tracking-wide text-emerald-200">ONLINE</span>
              <span className="text-[10px] text-emerald-400/80">Connection restored</span>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={handleDismiss}
          className="ml-1 p-0.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          title="Dismiss notification"
          aria-label="Dismiss notification"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </aside>
  );
};

export default NetworkStatusHUD;
