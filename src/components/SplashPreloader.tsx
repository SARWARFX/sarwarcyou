import React, { useState, useEffect, useRef } from 'react';
import { preloadInitialThumbnails } from '../utils/clientVideoThumbnails';

interface SplashPreloaderProps {
  isReady?: boolean;
  initialVideoUrls?: string[];
}

export const SplashPreloader: React.FC<SplashPreloaderProps> = ({
  isReady = false,
  initialVideoUrls = [],
}) => {
  const [status, setStatus] = useState<'STREAMING VAULT...' | 'READY'>('STREAMING VAULT...');
  const [progress, setProgress] = useState<number>(12);
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    // Only skip if explicitly flagged in session
    try {
      if (typeof window !== 'undefined' && sessionStorage.getItem('sarwarcyou_splash_completed') === 'true') {
        return false;
      }
    } catch {
      // storage unavailable
    }
    return true;
  });
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);

  // Living chromatic cycle for the monogram and glowing accents
  const [colorProgress, setColorProgress] = useState<number>(0);
  const startTimeRef = useRef<number>(0);
  const progressTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (startTimeRef.current === 0) {
      startTimeRef.current = performance.now();
    }
  }, []);

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

  // Smooth progress ticker: smoothly fills up to ~88% while initial Hugging Face metadata fetches
  useEffect(() => {
    if (!isVisible) return;

    progressTimerRef.current = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 88) return prev;
        const remaining = 90 - prev;
        const step = Math.max(0.6, remaining * 0.12);
        return Math.min(88, prev + step);
      });
    }, 60);

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;

    let fadeTimer: number;
    let removeTimer: number;
    let hasCompleted = false;

    const completePreload = () => {
      if (hasCompleted) return;
      hasCompleted = true;
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);

      setProgress(100);
      setStatus('READY');

      try {
        sessionStorage.setItem('sarwarcyou_splash_completed', 'true');
      } catch {
        // ignore storage errors
      }

      fadeTimer = window.setTimeout(() => {
        setIsFadingOut(true);
        removeTimer = window.setTimeout(() => {
          setIsVisible(false);
        }, 500);
      }, 350);
    };

    // Minimum smooth display threshold: ~1.4s to 1.6s
    const triggerCompleteWhenReady = () => {
      const elapsed = performance.now() - startTimeRef.current;
      const minDisplayThreshold = 1400;
      const remainingTime = Math.max(0, minDisplayThreshold - elapsed);

      window.setTimeout(() => {
        completePreload();
      }, remainingTime);
    };

    // Safety fallback timeout: max 2.8 seconds guarantees zero permanent lockout
    const hardTimeout = window.setTimeout(() => {
      completePreload();
    }, 2800);

    if (isReady) {
      if (initialVideoUrls && initialVideoUrls.length > 0) {
        preloadInitialThumbnails(initialVideoUrls, 6, 2600).then(() => {
          triggerCompleteWhenReady();
        });
      } else {
        triggerCompleteWhenReady();
      }
    }

    return () => {
      clearTimeout(hardTimeout);
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [isReady, initialVideoUrls, isVisible]);

  if (!isVisible) return null;

  // Calculate subtle chromatic color
  const hue = Math.round(colorProgress * 360);
  const glowColor = `hsl(${hue}, 85%, 65%)`;

  return (
    <div
      role="status"
      aria-label="Loading platform"
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black transition-opacity duration-500 ease-out select-none ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
      }`}
    >
      {/* Subtle ambient chromatic glow */}
      <div
        className="absolute w-80 h-80 rounded-full blur-3xl opacity-25 pointer-events-none transition-transform duration-1000 scale-100 animate-pulse"
        style={{
          background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
        }}
      />

      {/* Main Centered Content */}
      <div className="relative z-10 flex flex-col items-center gap-6 max-w-md px-6 text-center">
        {/* Breathing Glyphic Monogram */}
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
          <div
            className="absolute inset-0 rounded-2xl border border-white/10 animate-ping opacity-20"
            style={{ animationDuration: '2.4s' }}
          />
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-zinc-950 border border-white/15 shadow-[0_0_30px_rgba(255,255,255,0.06)] flex items-center justify-center overflow-hidden">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill={glowColor}
              style={{
                filter: `drop-shadow(0 0 14px ${glowColor})`,
                transition: 'fill 0.2s ease',
              }}
              className="w-6 h-6 sm:w-7 sm:h-7"
            >
              <path d="M5.5 3.868v16.264a1.5 1.5 0 002.28 1.282l13.553-8.132a1.5 1.5 0 000-2.564L7.78 2.586A1.5 1.5 0 005.5 3.868z" />
            </svg>
          </div>
        </div>

        {/* Wordmark */}
        <span className="font-space font-black tracking-[0.35em] text-xs sm:text-sm text-zinc-300 uppercase">
          SARWARCYOU
        </span>

        {/* Prominent Ad-Free Message */}
        <div className="flex flex-col items-center gap-1.5 my-1">
          <h1
            style={{
              textShadow: `0 0 24px ${glowColor}55, 0 0 45px ${glowColor}25`,
            }}
            className="font-space font-bold tracking-[0.2em] sm:tracking-[0.25em] text-sm sm:text-base md:text-lg text-white uppercase"
          >
            This site does not show ads
          </h1>
          <p className="font-mono text-[9px] sm:text-[10px] tracking-[0.22em] text-zinc-400 uppercase">
            Pure uninterrupted cinema and photography
          </p>
        </div>

        {/* Thin Animated Horizontal Loading Bar */}
        <div className="w-64 sm:w-72 md:w-80 flex flex-col items-center gap-2 mt-1">
          <div className="w-full h-[2px] bg-zinc-900/90 rounded-full overflow-hidden relative border border-white/10 shadow-inner">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, #00D2FF 0%, ${glowColor} 50%, #9D00FF 100%)`,
                boxShadow: `0 0 10px ${glowColor}`,
              }}
            />
          </div>

          <div className="w-full flex items-center justify-between text-[9px] font-mono tracking-widest text-zinc-500 uppercase px-0.5">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                  status === 'READY' ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-cyan-400 animate-pulse'
                }`}
              />
              <span className="text-zinc-400">{status}</span>
            </div>
            <span className="text-zinc-300 font-semibold">{Math.round(progress)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
