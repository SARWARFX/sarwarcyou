import React, { useState, useEffect, useCallback, useRef } from 'react';

export type NetworkType = 'offline' | 'cellular' | 'wifi';

function getNetworkType(): NetworkType {
  if (typeof navigator === 'undefined') return 'wifi';
  if (!navigator.onLine) return 'offline';
  const conn =
    (navigator as any).connection ||
    (navigator as any).mozConnection ||
    (navigator as any).webkitConnection;
  if (!conn) return 'wifi';
  if (conn.saveData === true || conn.type === 'cellular') return 'cellular';
  return 'wifi';
}

/**
 * NetworkStatusDialog
 * - Real-time network telemetry modal matching MediaNotFoundDialog & PlayerErrorBoundary:
 *   1. Red Alert: Disconnected from the Internet (Offline)
 *   2. Amber Warning: Metered / Cellular Connection (Alerts on each switch to cellular)
 *   3. Green Signal: Unmetered Wi-Fi Connection ("Good to go with no worry")
 */
export const NetworkStatusDialog: React.FC = () => {
  const [currentNetwork, setCurrentNetwork] = useState<NetworkType>(() => getNetworkType());
  const [showMeteredModal, setShowMeteredModal] = useState<boolean>(() => getNetworkType() === 'cellular');
  const [showWifiModal, setShowWifiModal] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const prevNetworkRef = useRef<NetworkType>(getNetworkType());

  useEffect(() => {
    const updateStatus = () => {
      const next = getNetworkType();
      const prev = prevNetworkRef.current;
      setCurrentNetwork(next);

      if (next !== prev) {
        prevNetworkRef.current = next;
        if (next === 'cellular') {
          setShowMeteredModal(true);
          setShowWifiModal(false);
        } else if (next === 'wifi') {
          // Alert user when switching back to Wi-Fi from cellular or recovering from offline
          if (prev === 'cellular' || prev === 'offline') {
            setShowWifiModal(true);
          }
          setShowMeteredModal(false);
        } else if (next === 'offline') {
          setShowMeteredModal(false);
          setShowWifiModal(false);
        }
      }
    };

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    const conn =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;
    if (conn && conn.addEventListener) {
      conn.addEventListener('change', updateStatus);
    }

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      if (conn && conn.removeEventListener) {
        conn.removeEventListener('change', updateStatus);
      }
    };
  }, []);

  const handleRetryConnection = useCallback(async () => {
    setIsChecking(true);
    if (navigator.onLine) {
      try {
        await fetch(window.location.origin + window.location.pathname, {
          method: 'HEAD',
          cache: 'no-store',
        });
        const net = getNetworkType();
        setCurrentNetwork(net);
        prevNetworkRef.current = net;
        if (net === 'wifi') setShowWifiModal(true);
        else if (net === 'cellular') setShowMeteredModal(true);
      } catch {
        setCurrentNetwork('offline');
      }
    } else {
      setCurrentNetwork('offline');
    }
    setTimeout(() => {
      setIsChecking(false);
    }, 600);
  }, []);

  // 1. Red Alert: Disconnected from the Internet
  if (currentNetwork === 'offline') {
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

  // 2. Amber Warning: Metered / Cellular Connection Alert
  if (currentNetwork === 'cellular' && showMeteredModal) {
    return (
      <div
        role="alertdialog"
        aria-modal="true"
        onClick={() => setShowMeteredModal(false)}
        className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/85 backdrop-blur-[20px] transition-opacity duration-200 select-none cursor-pointer"
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
            Your device is connected via a metered cellular data network. Streaming high-bitrate video clips and shorts transfers significant data volume and may rapidly consume your cellular plan allowance.
          </p>

          <div className="bg-[#030406] p-2.5 text-[11px] font-mono text-neutral-400 select-text flex items-center justify-between">
            <span className="text-[#f59e0b] font-bold">BANDWIDTH // CELLULAR</span>
            <span className="text-neutral-500">METERED PROTOCOL</span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setShowMeteredModal(false)}
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

  // 3. Green Signal: Unmetered Wi-Fi Connected
  if (currentNetwork === 'wifi' && showWifiModal) {
    return (
      <div
        role="alertdialog"
        aria-modal="true"
        onClick={() => setShowWifiModal(false)}
        className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/85 backdrop-blur-[20px] transition-opacity duration-200 select-none cursor-pointer"
        style={{ borderRadius: 0, outline: 'none', border: 'none' }}
      >
        <div
          className="relative w-full max-w-md bg-[#090c12] p-8 shadow-[0_24px_60px_rgba(0,0,0,0.95)] cursor-default text-white flex flex-col gap-4 animate-fade-in"
          style={{ borderRadius: 0, outline: 'none', border: 'none' }}
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-base font-bold font-mono tracking-tight text-[#10b981] uppercase flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#10b981] inline-block" />
            // UNMETERED WI-FI CONNECTED
          </h3>

          <p className="text-xs text-neutral-300 font-sans leading-relaxed">
            Your device is connected to an unmetered high-speed Wi-Fi network. High-bitrate media streaming, shorts, and video playback are fully optimized with unlimited data allowance. You are good to go with no worries.
          </p>

          <div className="bg-[#030406] p-2.5 text-[11px] font-mono text-neutral-400 select-text flex items-center justify-between">
            <span className="text-[#10b981] font-bold">PROTOCOL // WI-FI ONLINE</span>
            <span className="text-neutral-500">UNRESTRICTED BANDWIDTH</span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setShowWifiModal(false)}
              className="py-2 px-4 bg-[#10b981] text-black font-mono font-bold text-xs uppercase tracking-wider hover:bg-white transition-colors cursor-pointer"
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              Good to Go
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default NetworkStatusDialog;
