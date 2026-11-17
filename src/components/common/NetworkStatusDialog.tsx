import React, { useState, useEffect, useCallback } from 'react';

/**
 * NetworkStatusDialog
 * - Displays cybernetic HUD dialogs for:
 *   1. Red Alert: Internet Disconnection (Offline)
 *   2. Amber Warning: Metered / Cellular Connection Data Warning
 * - Exact 1:1 visual architecture as MediaNotFoundDialog & PlayerErrorBoundary:
 *   - 20px backdrop blur
 *   - Obsidian #090c12 card background
 *   - 0px border-radius, zero outlines, zero rounded corners
 *   - Science Gothic / Mono cybernetic typography
 */
export const NetworkStatusDialog: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return true;
    return typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
  });

  const [isChecking, setIsChecking] = useState<boolean>(false);

  const [isMetered, setIsMetered] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return false;
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (!conn) return false;
    return Boolean(conn.saveData === true || conn.type === 'cellular');
  });

  const [isMeteredDismissed, setIsMeteredDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return sessionStorage.getItem('sarwar_metered_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  // Monitor online / offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setIsChecking(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Network Information API change listener
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    const handleConnChange = () => {
      if (conn) {
        setIsMetered(Boolean(conn.saveData === true || conn.type === 'cellular'));
      }
    };

    if (conn && conn.addEventListener) {
      conn.addEventListener('change', handleConnChange);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (conn && conn.removeEventListener) {
        conn.removeEventListener('change', handleConnChange);
      }
    };
  }, []);

  const handleRetryConnection = useCallback(async () => {
    setIsChecking(true);
    if (navigator.onLine) {
      try {
        await fetch(window.location.origin + window.location.pathname, { method: 'HEAD', cache: 'no-store' });
        setIsOnline(true);
      } catch {
        setIsOnline(false);
      }
    } else {
      setIsOnline(false);
    }
    setTimeout(() => {
      setIsChecking(false);
    }, 600);
  }, []);

  const handleDismissMetered = useCallback(() => {
    setIsMeteredDismissed(true);
    try {
      sessionStorage.setItem('sarwar_metered_dismissed', 'true');
    } catch {
      // ignore
    }
  }, []);

  // 1. Offline Disconnection takes top priority (Red Alert)
  if (!isOnline) {
    return (
      <div
        role="alertdialog"
        aria-modal="true"
        className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/85 backdrop-blur-[20px] transition-opacity duration-200 select-none"
        style={{ borderRadius: 0, outline: 'none', border: 'none' }}
      >
        <div
          className="relative w-full max-w-md bg-[#090c12] p-8 shadow-[0_24px_60px_rgba(0,0,0,0.95)] cursor-default text-white flex flex-col gap-4 animate-fade-in"
          style={{ borderRadius: 0, outline: 'none', border: 'none' }}
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-base font-bold font-mono tracking-tight text-[#ef4444] uppercase flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#ef4444] animate-ping inline-block" />
            // NETWORK DISCONNECTED
          </h3>

          <p className="text-xs text-neutral-300 font-sans leading-relaxed">
            Your device is currently disconnected from the internet. High-resolution video playback, short streams, and live vault telemetry have been paused until connectivity is restored.
          </p>

          <div className="bg-[#030406] p-2.5 text-[11px] font-mono text-neutral-400 select-text flex items-center justify-between">
            <span className="text-[#ef4444] font-bold">STATUS // OFFLINE</span>
            <span className="text-neutral-500">SIGNAL INTERRUPTED</span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              disabled={isChecking}
              onClick={handleRetryConnection}
              className="py-2 px-4 bg-[#ef4444] text-white font-mono font-bold text-xs uppercase tracking-wider hover:bg-white hover:text-black transition-colors cursor-pointer disabled:opacity-50"
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              {isChecking ? 'Checking...' : 'Retry Connection'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Metered / Cellular Connection Warning (Amber Alert)
  if (isMetered && !isMeteredDismissed) {
    return (
      <div
        role="alertdialog"
        aria-modal="true"
        className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/85 backdrop-blur-[20px] transition-opacity duration-200 select-none"
        style={{ borderRadius: 0, outline: 'none', border: 'none' }}
      >
        <div
          className="relative w-full max-w-md bg-[#090c12] p-8 shadow-[0_24px_60px_rgba(0,0,0,0.95)] cursor-default text-white flex flex-col gap-4 animate-fade-in"
          style={{ borderRadius: 0, outline: 'none', border: 'none' }}
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-base font-bold font-mono tracking-tight text-[#f59e0b] uppercase flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#f59e0b] inline-block" />
            // METERED NETWORK DETECTED
          </h3>

          <p className="text-xs text-neutral-300 font-sans leading-relaxed">
            Your device is connected via a metered or cellular data network. Streaming high-bitrate video clips and shorts transfers significant data volume and may rapidly consume your cellular plan allowance.
          </p>

          <div className="bg-[#030406] p-2.5 text-[11px] font-mono text-neutral-400 select-text flex items-center justify-between">
            <span className="text-[#f59e0b] font-bold">BANDWIDTH // CELLULAR</span>
            <span className="text-neutral-500">METERED PROTOCOL</span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={handleDismissMetered}
              className="py-2 px-4 bg-[#f59e0b] text-black font-mono font-bold text-xs uppercase tracking-wider hover:bg-white transition-colors cursor-pointer"
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              Acknowledge & Proceed
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default NetworkStatusDialog;
