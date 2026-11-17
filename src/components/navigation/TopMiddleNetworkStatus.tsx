import React, { useState, useEffect } from 'react';

export const TopMiddleNetworkStatus: React.FC = () => {
  const [networkState, setNetworkState] = useState<'wifi' | 'mobile' | 'offline'>(() => {
    if (typeof navigator === 'undefined') return 'wifi';
    if (!navigator.onLine) return 'offline';
    const conn =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;
    if (conn && (conn.type === 'cellular' || conn.saveData === true)) {
      return 'mobile';
    }
    return 'wifi';
  });

  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      const conn =
        (navigator as any).connection ||
        (navigator as any).mozConnection ||
        (navigator as any).webkitConnection;
      if (conn && (conn.type === 'cellular' || conn.saveData === true)) {
        setNetworkState('mobile');
      } else {
        setNetworkState('wifi');
      }
    };

    const handleOffline = () => {
      setNetworkState('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const conn =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    if (conn && conn.addEventListener) {
      conn.addEventListener('change', handleOnline);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (conn && conn.removeEventListener) {
        conn.removeEventListener('change', handleOnline);
      }
    };
  }, []);

  // When visitor is on Wi-Fi/broadband, the website says nothing (completely silent and invisible)
  if (networkState === 'wifi') {
    return null;
  }

  const isOffline = networkState === 'offline';

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative flex flex-col items-center select-none"
      style={{ borderRadius: 0, outline: 'none', border: 'none' }}
    >
      <div
        className={`flex items-center gap-2 px-3 py-1 font-mono text-[10.5px] font-bold tracking-[0.14em] uppercase transition-colors cursor-help ${
          isOffline
            ? 'bg-[#1a080a] text-[#ef4444] animate-pulse'
            : 'bg-[#081a12] text-[#22c55e]'
        }`}
        style={{ borderRadius: 0, outline: 'none', border: 'none' }}
      >
        {/* 4 Micro Signal Pillars */}
        <div className="flex items-end gap-[2px] h-[11px]">
          <span className="w-[2px] h-[3px] bg-currentColor" />
          <span className="w-[2px] h-[6px] bg-currentColor" />
          <span className="w-[2px] h-[8px] bg-currentColor" />
          <span className="w-[2px] h-[11px] bg-currentColor" />
        </div>
        <span>{isOffline ? 'OFFLINE' : 'MOBILE DATA'}</span>
      </div>

      {/* Hover Tooltip for Mobile Data Warning */}
      {!isOffline && isHovered && (
        <div
          className="absolute top-full mt-2 w-72 p-3 bg-[#090c12] text-[#cbd5e1] text-[11px] font-sans leading-relaxed shadow-2xl z-50 pointer-events-none"
          style={{ borderRadius: 0, outline: 'none', border: 'none' }}
        >
          Connected via mobile data. Streaming high-resolution media may cause significant cellular data usage.
        </div>
      )}
    </div>
  );
};

export default TopMiddleNetworkStatus;
