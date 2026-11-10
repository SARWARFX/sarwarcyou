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
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[999999] pointer-events-auto transition-all duration-300 ease-out select-none ${
        isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
      } ${className}`}
    >
      <div
        className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border shadow-2xl backdrop-blur-2xl text-xs font-mono transition-all duration-300 ${
          isOffline
            ? 'bg-[#050505]/95 border-[#ff0055] text-white shadow-[0_0_35px_rgba(255,0,85,0.35)]'
            : 'bg-[#050505]/95 border-[#ccff00] text-white shadow-[0_0_35px_rgba(204,255,0,0.35)]'
        }`}
      >
        {isOffline ? (
          <>
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff0055] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#ff0055]" />
            </span>
            <div className="w-7 h-7 rounded-full bg-[#ff0055]/15 border border-[#ff0055]/30 flex items-center justify-center shrink-0">
              <WifiOff className="w-3.5 h-3.5 text-[#ff0055]" />
            </div>
            <div className="flex flex-col pr-1 min-w-[200px]">
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-widest text-[#ff0055] uppercase text-[11px]">
                  INTERNET DISCONNECTED
                </span>
                <span className="px-1.5 py-0.5 rounded bg-[#ff0055]/20 text-[#ff0055] text-[9px] font-bold tracking-wider">
                  OFFLINE
                </span>
              </div>
              <span className="text-[10px] text-neutral-400 tracking-wide mt-0.5">
                SARWAR.CYOU // Running on cached memory
              </span>
            </div>
          </>
        ) : (
          <>
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ccff00] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#ccff00]" />
            </span>
            <div className="w-7 h-7 rounded-full bg-[#ccff00]/15 border border-[#ccff00]/30 flex items-center justify-center shrink-0">
              <Wifi className="w-3.5 h-3.5 text-[#ccff00]" />
            </div>
            <div className="flex flex-col pr-1 min-w-[200px]">
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-widest text-[#ccff00] uppercase text-[11px]">
                  CONNECTION RESTORED
                </span>
                <span className="px-1.5 py-0.5 rounded bg-[#ccff00]/20 text-black font-bold tracking-wider text-[9px] bg-[#ccff00]">
                  LIVE
                </span>
              </div>
              <span className="text-[10px] text-neutral-400 tracking-wide mt-0.5">
                Cloud uplink synchronized // Biennale 2026
              </span>
            </div>
          </>
        )}

        <button
          type="button"
          onClick={handleDismiss}
          className="ml-2 p-1 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer border border-transparent hover:border-white/10 shrink-0"
          title="Dismiss notification"
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};

export default NetworkStatusHUD;
