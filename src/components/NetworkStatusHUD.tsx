import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Wifi, WifiOff, X } from 'lucide-react';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

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
    let isSubscribed = true;

    // 1. Initial status query via native Capacitor Network API
    Network.getStatus().then((netStatus) => {
      if (!isSubscribed) return;
      if (!netStatus.connected) {
        handleOfflineTransition();
      }
    }).catch(() => {});

    // 2. Native Capacitor Android Network Listener (detects real-time carrier & Wi-Fi changes)
    const listenerPromise = Network.addListener('networkStatusChange', (netStatus) => {
      if (!isSubscribed) return;
      if (!netStatus.connected) {
        handleOfflineTransition();
      } else {
        handleOnlineTransition();
      }
    });

    // 3. Browser DOM Events Fallback
    const handleDomOnline = () => handleOnlineTransition();
    const handleDomOffline = () => handleOfflineTransition();

    window.addEventListener('online', handleDomOnline);
    window.addEventListener('offline', handleDomOffline);

    // 4. Periodic heartbeat check (every 5 seconds) to catch silent drops
    const heartbeatInterval = setInterval(async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const s = await Network.getStatus();
          if (!s.connected) {
            handleOfflineTransition();
          } else if (wasOfflineRef.current) {
            handleOnlineTransition();
          }
        } else {
          if (!navigator.onLine) {
            handleOfflineTransition();
          } else if (wasOfflineRef.current) {
            handleOnlineTransition();
          }
        }
      } catch (_) {}
    }, 5000);

    return () => {
      isSubscribed = false;
      clearTimer();
      clearInterval(heartbeatInterval);
      window.removeEventListener('online', handleDomOnline);
      window.removeEventListener('offline', handleDomOffline);
      listenerPromise.then((handle) => handle.remove()).catch(() => {});
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
        className={`relative flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl border backdrop-blur-2xl transition-all duration-300 shadow-[0_20px_50px_rgba(0,0,0,0.85)] ${
          isOffline
            ? 'bg-[#0f1015]/95 border-white/15 text-white'
            : 'bg-[#0f1015]/95 border-white/20 text-white'
        }`}
      >
        {/* Left: Icon & Notification Text */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
              isOffline
                ? 'bg-white/10 border-white/15 text-white'
                : 'bg-white text-black border-transparent'
            }`}
          >
            {isOffline ? (
              <WifiOff className="w-5 h-5 text-white" />
            ) : (
              <Wifi className="w-5 h-5 text-black" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-['Roboto_Condensed'] font-bold uppercase tracking-wider text-white">
                {isOffline ? "You're Offline" : 'Back Online'}
              </h4>
              <span
                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                  isOffline
                    ? 'bg-white/10 text-white/90 border-white/20'
                    : 'bg-white text-black border-transparent'
                }`}
              >
                {isOffline ? 'OFFLINE' : 'ONLINE'}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-zinc-400 truncate mt-0.5 font-sans">
              {isOffline
                ? 'Device has lost internet connection. Saved files remain available.'
                : 'Internet connectivity restored.'}
            </p>
          </div>
        </div>

        {/* Right: Dismiss button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.06] hover:bg-white/[0.12] text-zinc-400 hover:text-white transition-all shrink-0 cursor-pointer border border-white/10 active:scale-95"
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
