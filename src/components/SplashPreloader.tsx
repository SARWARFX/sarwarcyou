import React, { useState, useEffect } from 'react';

interface SplashPreloaderProps {
  isReady?: boolean;
}

export const SplashPreloader: React.FC<SplashPreloaderProps> = ({ isReady = false }) => {
  const [status, setStatus] = useState<'SYNCING VAULT...' | 'READY'>('SYNCING VAULT...');
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  // Living chromatic cycle for the monogram
  const [colorProgress, setColorProgress] = useState(0);

  useEffect(() => {
    let frameId: number;
    const start = performance.now();
    const update = (now: number) => {
      setColorProgress(((now - start) % 4000) / 4000);
      frameId = requestAnimationFrame(update);
    };
    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    let fadeTimer: number;
    let removeTimer: number;

    const completePreload = () => {
      setStatus('READY');
      fadeTimer = window.setTimeout(() => {
        setIsFadingOut(true);
        removeTimer = window.setTimeout(() => {
          setIsVisible(false);
        }, 500);
      }, 200);
    };

    // If data is ready early
    if (isReady) {
      completePreload();
      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(removeTimer);
      };
    }

    // Fail-safe hard timeout: max 1500ms guarantees zero lockout
    const hardTimeout = window.setTimeout(() => {
      completePreload();
    }, 1500);

    return () => {
      clearTimeout(hardTimeout);
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [isReady]);

  if (!isVisible) return null;

  // Calculate subtle chromatic color
  const hue = Math.round(colorProgress * 360);
  const glowColor = `hsl(${hue}, 80%, 65%)`;

  return (
    <div
      role="status"
      aria-label="Loading portfolio"
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black transition-opacity duration-500 ease-out select-none ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
      }`}
    >
      {/* Subtle background ambient pulse */}
      <div
        className="absolute w-72 h-72 rounded-full blur-3xl opacity-20 pointer-events-none transition-transform duration-1000 scale-100 animate-pulse"
        style={{
          background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
        }}
      />

      {/* Centered Minimalist Monogram */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        {/* Breathing Glyphic Monogram */}
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
          <div
            className="absolute inset-0 rounded-2xl border border-white/10 animate-ping opacity-20"
            style={{ animationDuration: '2s' }}
          />
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-zinc-950 border border-white/15 shadow-[0_0_30px_rgba(255,255,255,0.06)] flex items-center justify-center overflow-hidden">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill={glowColor}
              style={{
                filter: `drop-shadow(0 0 12px ${glowColor})`,
                transition: 'fill 0.2s ease',
              }}
              className="w-6 h-6 sm:w-7 sm:h-7"
            >
              <path d="M5.5 3.868v16.264a1.5 1.5 0 002.28 1.282l13.553-8.132a1.5 1.5 0 000-2.564L7.78 2.586A1.5 1.5 0 005.5 3.868z" />
            </svg>
          </div>
        </div>

        {/* Wordmark */}
        <div className="flex flex-col items-center gap-2">
          <span className="font-space font-black tracking-[0.3em] text-xs sm:text-sm text-zinc-100 uppercase">
            SARWARCYOU
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                status === 'READY' ? 'bg-emerald-400' : 'bg-cyan-400 animate-pulse'
              }`}
            />
            <span className="font-mono text-[9px] tracking-[0.25em] text-zinc-500 uppercase">
              {status}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
